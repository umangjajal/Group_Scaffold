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
    initializeTerminal();
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

    const onTerminalData = (data) => xtermRef.current?.write(data);
    const onTerminalReady = () => {
      fitAddonRef.current?.fit();
      socket.emit('terminal:resize', { cols: xtermRef.current.cols, rows: xtermRef.current.rows });
    };

    socket.on('collab:file:snapshot', onSnapshot);
    socket.on('collab:file:patched', onPatched);
    socket.on('collab:file:commented', onCommented);
    socket.on('terminal:data', onTerminalData);
    socket.on('terminal:ready', onTerminalReady);
    socket.on('terminal:error', ({ message }) => setError(message));

    return () => {
      socket.off('collab:file:snapshot', onSnapshot);
      socket.off('collab:file:patched', onPatched);
      socket.off('collab:file:commented', onCommented);
      socket.off('terminal:data', onTerminalData);
      socket.off('terminal:ready', onTerminalReady);
      socket.emit('terminal:stop');
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

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
        theme: { background: '#0f172a' },
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
    socket.emit('collab:file:patch', { fileId: selectedFileId, delta: { cellId, value, lock: true }, patchSummary: `Cell ${cellId} updated` });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
      <aside className="xl:col-span-3 bg-slate-900 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold">Collab Files</h2>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <form onSubmit={createFile} className="space-y-2">
          <input className="w-full px-2 py-1 rounded bg-slate-800" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="New file name" />
          <select className="w-full px-2 py-1 rounded bg-slate-800" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            {FILE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <button className="w-full bg-indigo-600 rounded py-1">Create file</button>
        </form>

        <label className="block text-sm">Upload file
          <input type="file" className="w-full mt-1 text-xs" onChange={uploadFile} />
        </label>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {files.map((file) => (
            <button key={file._id} onClick={() => selectFile(file._id)} className={`w-full text-left px-2 py-1 rounded ${selectedFileId === file._id ? 'bg-indigo-700' : 'bg-slate-800'}`}>
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-slate-300">{file.type} • v{file.latestVersion}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="xl:col-span-6 bg-slate-900 rounded-lg p-3 space-y-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold">{selectedFile?.name || 'Select a file'}</h2>
          <button onClick={saveVersion} disabled={!selectedFileId} className="px-3 py-1 bg-emerald-600 rounded text-sm disabled:opacity-50">Save version</button>
        </div>

        {isTextEditable && (
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onSelect={(e) => {
              const pos = e.target.selectionStart || 0;
              setCursor(pos);
              socket.emit('collab:file:cursor', { fileId: selectedFileId, position: pos });
            }}
            className="w-full min-h-[280px] bg-slate-800 rounded p-3 font-mono"
            placeholder="Start collaborating..."
          />
        )}

        {isSpreadsheet && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr><th className="p-1" />{SPREADSHEET_COLUMNS.map((col) => <th key={col} className="p-1 text-left">{col}</th>)}</tr></thead>
              <tbody>
                {SPREADSHEET_ROWS.map((row) => (
                  <tr key={row}>
                    <td className="p-1 text-slate-300">{row}</td>
                    {SPREADSHEET_COLUMNS.map((col) => {
                      const id = `${col}${row}`;
                      const cell = selectedFile?.content?.cells?.[id];
                      return (
                        <td key={id} className="p-1">
                          <input value={cell?.value || ''} onChange={(e) => onSpreadsheetCellChange(id, e.target.value)} className="w-full px-2 py-1 bg-slate-800 rounded" />
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
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            This uploaded file is binary and cannot be edited inline. Upload code/text files (`.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, etc.) to edit directly.
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Inline comments & mentions</h3>
          <div className="flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment... use @<userObjectId>" className="flex-1 px-2 py-1 rounded bg-slate-800" />
            <button onClick={submitComment} className="px-3 py-1 bg-blue-600 rounded">Comment</button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Integrated Terminal</h3>
          <div ref={terminalRef} className="h-52 rounded border border-slate-700 overflow-hidden" />
        </div>
      </main>

      <section className="xl:col-span-3 bg-slate-900 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold">Version History</h2>
        <div className="max-h-48 overflow-auto space-y-1 text-sm">
          {history.map((version) => (
            <div key={version._id} className="bg-slate-800 rounded px-2 py-1 flex items-center justify-between">
              <div>v{version.version} • {version.patchSummary}</div>
              <button onClick={() => restoreVersion(version.version)} className="text-xs text-emerald-300">Restore</button>
            </div>
          ))}
        </div>

        <h2 className="font-semibold">Push to Git</h2>
        <input value={gitMessage} onChange={(e) => setGitMessage(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-800 text-sm" placeholder="Commit message" />
        <button onClick={pushToGit} className="w-full py-1 bg-fuchsia-600 rounded">Push main branch</button>

        <h2 className="font-semibold">Audit Trail</h2>
        <div className="max-h-48 overflow-auto space-y-1 text-xs">
          {activity.map((log) => (
            <div key={log._id} className="bg-slate-800 rounded px-2 py-1">
              <div className="font-medium">{log.action}</div>
              <div>{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
