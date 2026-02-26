import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { socket, connectSocket } from '../socket';

const FILE_TYPES = ['document', 'code', 'spreadsheet'];
const SPREADSHEET_COLUMNS = ['A', 'B', 'C', 'D'];
const SPREADSHEET_ROWS = [1, 2, 3, 4, 5, 6];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = 'false';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function Collaboration() {
  const { groupId } = useParams();
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('document');
  const [cursor, setCursor] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [gitMessage, setGitMessage] = useState('collab update');

  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    connectSocket();
    fetchFiles();
    fetchActivity();

    const onSnapshot = (payload) => {
      if (payload.fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), ...payload }));
    };

    const onPatched = ({ fileId, content, version }) => {
      if (fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), content, version }));
    };

    const onCommented = ({ fileId, comment: newComment }) => {
      if (fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), comments: [newComment, ...(current?.comments || [])] }));
    };

    socket.on('collab:file:snapshot', onSnapshot);
    socket.on('collab:file:patched', onPatched);
    socket.on('collab:file:commented', onCommented);

    return () => {
      socket.off('collab:file:snapshot', onSnapshot);
      socket.off('collab:file:patched', onPatched);
      socket.off('collab:file:commented', onCommented);
    };
  }, [selectedFileId, groupId]);

  useEffect(() => {
    initializeTerminal();

    const onTerminalData = (data) => xtermRef.current?.write(data);
    const onTerminalReady = () => {
      fitAddonRef.current?.fit();
      socket.emit('terminal:resize', { cols: xtermRef.current.cols, rows: xtermRef.current.rows });
    };

    socket.on('terminal:data', onTerminalData);
    socket.on('terminal:ready', onTerminalReady);
    socket.on('terminal:error', ({ message }) => setError(message));

    return () => {
      socket.off('terminal:data', onTerminalData);
      socket.off('terminal:ready', onTerminalReady);
      socket.emit('terminal:stop');
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textValue = useMemo(() => String(selectedFile?.content?.text || ''), [selectedFile]);
  const isSpreadsheet = selectedFile?.type === 'spreadsheet';
  const isBinaryUpload = Boolean(selectedFile?.content?.binary);
  const isTextEditable = !isSpreadsheet && !isBinaryUpload;

  async function initializeTerminal() {
    if (!terminalRef.current || xtermRef.current) return;

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xterm@5.5.0/lib/xterm.js');
      await loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js');
      const styleId = 'xterm-css-cdn';
      if (!document.getElementById(styleId)) {
        const link = document.createElement('link');
        link.id = styleId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.5.0/css/xterm.css';
        document.head.appendChild(link);
      }

      const TerminalClass = window.Terminal;
      const FitAddonClass = window.FitAddon?.FitAddon;

      if (!TerminalClass || !FitAddonClass) {
        setError('Unable to load xterm.js terminal assets.');
        return;
      }

      const term = new TerminalClass({
        cursorBlink: true,
        fontSize: 13,
        theme: { background: '#050b14' },
      });
      const fitAddon = new FitAddonClass();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.onData((data) => socket.emit('terminal:input', { data }));
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      socket.emit('terminal:start', { cols: term.cols, rows: term.rows });
    } catch (e) {
      setError(e.message || 'Terminal initialization failed.');
    }
  }

  async function fetchFiles() {
    try {
      const { data } = await api.get(`/collab/groups/${groupId}/files`);
      setFiles(data);
      if (!selectedFileId && data[0]) {
        selectFile(data[0]._id);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to fetch files.');
    }
  }

  async function fetchActivity() {
    try {
      const { data } = await api.get('/collab/activity', { params: { groupId } });
      setActivity(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to fetch activity.');
    }
  }

  async function selectFile(fileId) {
    if (!fileId) return;
    try {
      setSelectedFileId(fileId);
      const { data } = await api.get(`/collab/files/${fileId}`);
      setSelectedFile(data);
      const historyRes = await api.get(`/collab/files/${fileId}/history`);
      setHistory(historyRes.data);
      socket.emit('collab:file:join', { fileId });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load file.');
    }
  }

  async function createFile(e) {
    e.preventDefault();
    if (!fileName.trim()) return;
    try {
      const { data } = await api.post(`/collab/groups/${groupId}/files`, { name: fileName.trim(), type: fileType });
      setFileName('');
      await fetchFiles();
      await selectFile(data._id);
      await fetchActivity();
    } catch (e2) {
      setError(e2.response?.data?.error || 'Failed to create file.');
    }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/collab/groups/${groupId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchFiles();
      await selectFile(data._id);
      await fetchActivity();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    }
  }

  async function saveVersion() {
    if (!selectedFileId) return;
    try {
      await api.post(`/collab/files/${selectedFileId}/versions`, { patchSummary: 'Manual checkpoint' });
      const historyRes = await api.get(`/collab/files/${selectedFileId}/history`);
      setHistory(historyRes.data);
      await fetchActivity();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save version.');
    }
  }

  async function restoreVersion(version) {
    if (!selectedFileId) return;
    try {
      await api.post(`/collab/files/${selectedFileId}/restore/${version}`);
      await selectFile(selectedFileId);
      await fetchActivity();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to restore version.');
    }
  }

  async function pushToGit() {
    try {
      const { data } = await api.post('/collab/git/push', { groupId, commitMessage: gitMessage, branch: 'main' });
      await fetchActivity();
      setError(data.message || 'Git push completed.');
    } catch (e) {
      setError(e.response?.data?.error || 'Git push failed.');
    }
  }

  function onTextChange(nextValue) {
    if (!selectedFileId || !isTextEditable) return;
    const delta = { from: 0, to: textValue.length, text: nextValue };
    socket.emit('collab:file:patch', { fileId: selectedFileId, delta, patchSummary: 'Live text sync' });
  }

  function onSpreadsheetCellChange(cellId, value) {
    if (!selectedFileId) return;
    socket.emit('collab:file:patch', {
      fileId: selectedFileId,
      delta: { cellId, value, lock: true },
      patchSummary: `Cell ${cellId} updated`,
    });
  }

  function submitComment() {
    if (!comment.trim() || !selectedFileId) return;
    const mentionIds = Array.from(comment.matchAll(/@([a-f\d]{24})/gi)).map((m) => m[1]);
    socket.emit('collab:file:comment', {
      fileId: selectedFileId,
      text: comment.trim(),
      line: selectedFile?.type === 'code' ? cursor : null,
      mentions: mentionIds,
    });
    setComment('');
  }

  return (
    <div className="room-workspace-page">
      <section className="workspace-grid">
        <aside className="workspace-card">
          <h2 className="workspace-card__title">Files</h2>
          {error && <div className="dashboard-alert dashboard-alert--error" style={{ marginTop: '0.7rem', marginBottom: 0 }}>{error}</div>}

          <form onSubmit={createFile} className="workspace-form-grid" style={{ marginTop: '0.7rem' }}>
            <input
              className="input-control"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="New file name"
            />
            <select className="select-control" value={fileType} onChange={(e) => setFileType(e.target.value)}>
              {FILE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button className="btn btn--primary" type="submit">Create File</button>
          </form>

          <label className="auth-label" htmlFor="file-upload" style={{ marginTop: '0.8rem' }}>Upload File</label>
          <input id="file-upload" type="file" className="input-control" onChange={uploadFile} />

          <div className="workspace-list" style={{ marginTop: '0.8rem' }}>
            {files.map((file) => (
              <button
                key={file._id}
                onClick={() => selectFile(file._id)}
                className={`workspace-list__item ${selectedFileId === file._id ? 'is-active' : ''}`}
              >
                <strong>{file.name}</strong>
                <div>{file.type} | v{file.latestVersion}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="workspace-card workspace-editor">
          <header className="room-header" style={{ marginBottom: '0.7rem' }}>
            <div>
              <h2 className="room-header__title">{selectedFile?.name || 'Select a file'}</h2>
              <p className="room-header__subtitle">Live editing with version checkpoints.</p>
            </div>
            <button onClick={saveVersion} disabled={!selectedFileId} className="btn btn--secondary">
              Save Version
            </button>
          </header>

          {isTextEditable && (
            <textarea
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              onSelect={(e) => {
                const pos = e.target.selectionStart || 0;
                setCursor(pos);
                socket.emit('collab:file:cursor', { fileId: selectedFileId, position: pos });
              }}
              className="workspace-text-editor"
              placeholder="Start collaborating..."
            />
          )}

          {isSpreadsheet && (
            <div style={{ overflow: 'auto' }}>
              <table className="workspace-spreadsheet">
                <thead>
                  <tr>
                    <th />
                    {SPREADSHEET_COLUMNS.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SPREADSHEET_ROWS.map((row) => (
                    <tr key={row}>
                      <td>{row}</td>
                      {SPREADSHEET_COLUMNS.map((col) => {
                        const id = `${col}${row}`;
                        const cell = selectedFile?.content?.cells?.[id];
                        return (
                          <td key={id}>
                            <input
                              value={cell?.value || ''}
                              onChange={(e) => onSpreadsheetCellChange(id, e.target.value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isSpreadsheet && isBinaryUpload && (
            <div className="dashboard-alert" style={{ borderColor: 'rgba(245, 158, 11, 0.42)', color: '#fcd34d', background: 'rgba(120, 53, 15, 0.3)' }}>
              This file is binary and cannot be edited inline. Upload text or code files for editing.
            </div>
          )}

          <section className="workspace-card" style={{ marginTop: '0.7rem' }}>
            <h3 className="workspace-card__title">Inline Comments</h3>
            <div className="workspace-row" style={{ marginTop: '0.6rem' }}>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment... use @userObjectId"
                className="input-control"
              />
              <button onClick={submitComment} className="btn btn--secondary">Comment</button>
            </div>
          </section>

          <section className="workspace-card" style={{ marginTop: '0.7rem' }}>
            <h3 className="workspace-card__title">Terminal</h3>
            <div ref={terminalRef} className="workspace-terminal" />
          </section>
        </main>
      </section>

      <aside className="workspace-sidebar">
        <section className="workspace-card">
          <h2 className="workspace-card__title">Version History</h2>
          <div style={{ marginTop: '0.65rem' }}>
            {history.map((version) => (
              <article key={version._id} className="workspace-history-item">
                <div className="workspace-history-row">
                  <span>v{version.version} | {version.patchSummary}</span>
                  <button onClick={() => restoreVersion(version.version)} className="btn btn--ghost">Restore</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-card">
          <h2 className="workspace-card__title">Push to Git</h2>
          <div className="workspace-form-grid" style={{ marginTop: '0.65rem' }}>
            <input
              value={gitMessage}
              onChange={(e) => setGitMessage(e.target.value)}
              className="input-control"
              placeholder="Commit message"
            />
            <button onClick={pushToGit} className="btn btn--secondary">Push Main Branch</button>
          </div>
        </section>

        <section className="workspace-card">
          <h2 className="workspace-card__title">Audit Feed</h2>
          <div style={{ marginTop: '0.65rem' }}>
            {activity.map((log) => (
              <article key={log._id} className="workspace-audit-item">
                <strong>{log.action}</strong>
                <p>{new Date(log.createdAt).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
