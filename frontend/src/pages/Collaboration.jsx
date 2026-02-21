import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { socket, connectSocket } from '../socket';

const FILE_TYPES = ['document', 'code', 'spreadsheet'];
const SPREADSHEET_COLUMNS = ['A', 'B', 'C', 'D'];
const SPREADSHEET_ROWS = [1, 2, 3, 4, 5, 6];

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

  useEffect(() => {
    connectSocket();
    fetchFiles();
    fetchActivity();

    socket.on('collab:file:snapshot', (payload) => {
      if (payload.fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), ...payload }));
    });

    socket.on('collab:file:patched', ({ fileId, content, version }) => {
      if (fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), content, version }));
    });

    socket.on('collab:file:commented', ({ fileId, comment: newComment }) => {
      if (fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), comments: [newComment, ...(current?.comments || [])] }));
    });

    return () => {
      socket.off('collab:file:snapshot');
      socket.off('collab:file:patched');
      socket.off('collab:file:commented');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  const textValue = useMemo(() => String(selectedFile?.content?.text || ''), [selectedFile]);

  async function fetchFiles() {
    const { data } = await api.get(`/collab/groups/${groupId}/files`);
    setFiles(data);
    if (!selectedFileId && data[0]) {
      selectFile(data[0]._id);
    }
  }

  async function fetchActivity() {
    const { data } = await api.get('/collab/activity', { params: { groupId } });
    setActivity(data);
  }

  async function selectFile(fileId) {
    setSelectedFileId(fileId);
    const { data } = await api.get(`/collab/files/${fileId}`);
    setSelectedFile(data);
    const historyRes = await api.get(`/collab/files/${fileId}/history`);
    setHistory(historyRes.data);
    socket.emit('collab:file:join', { fileId });
  }

  async function createFile(e) {
    e.preventDefault();
    if (!fileName.trim()) return;
    await api.post(`/collab/groups/${groupId}/files`, { name: fileName.trim(), type: fileType });
    setFileName('');
    await fetchFiles();
    await fetchActivity();
  }

  async function saveVersion() {
    if (!selectedFileId) return;
    await api.post(`/collab/files/${selectedFileId}/versions`, { patchSummary: 'Manual checkpoint' });
    const historyRes = await api.get(`/collab/files/${selectedFileId}/history`);
    setHistory(historyRes.data);
  }

  async function restoreVersion(version) {
    if (!selectedFileId) return;
    await api.post(`/collab/files/${selectedFileId}/restore/${version}`);
    await selectFile(selectedFileId);
    await fetchActivity();
  }

  function onTextChange(nextValue) {
    const delta = { from: 0, to: textValue.length, text: nextValue };
    socket.emit('collab:file:patch', { fileId: selectedFileId, delta, patchSummary: 'Live text sync' });
  }

  function onSpreadsheetCellChange(cellId, value) {
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
        <form onSubmit={createFile} className="space-y-2">
          <input className="w-full px-2 py-1 rounded bg-slate-800" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="New file name" />
          <select className="w-full px-2 py-1 rounded bg-slate-800" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            {FILE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <button className="w-full bg-indigo-600 rounded py-1">Create file</button>
        </form>

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
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">{selectedFile?.name || 'Select a file'}</h2>
          <button onClick={saveVersion} className="px-3 py-1 bg-emerald-600 rounded text-sm">Save version</button>
        </div>

        {selectedFile?.type !== 'spreadsheet' && (
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onSelect={(e) => {
              const pos = e.target.selectionStart || 0;
              setCursor(pos);
              socket.emit('collab:file:cursor', { fileId: selectedFileId, position: pos });
            }}
            className="w-full min-h-[340px] bg-slate-800 rounded p-3 font-mono"
            placeholder="Start collaborating..."
          />
        )}

        {selectedFile?.type === 'spreadsheet' && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr><th className="p-1" />{SPREADSHEET_COLUMNS.map((col) => <th key={col} className="p-1 text-left">{col}</th>)}</tr>
              </thead>
              <tbody>
                {SPREADSHEET_ROWS.map((row) => (
                  <tr key={row}>
                    <td className="p-1 text-slate-300">{row}</td>
                    {SPREADSHEET_COLUMNS.map((col) => {
                      const id = `${col}${row}`;
                      const cell = selectedFile?.content?.cells?.[id];
                      return (
                        <td key={id} className="p-1">
                          <input
                            value={cell?.value || ''}
                            onChange={(e) => onSpreadsheetCellChange(id, e.target.value)}
                            className="w-full px-2 py-1 bg-slate-800 rounded"
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

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Inline comments & mentions</h3>
          <div className="flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment... use @<userObjectId> to mention" className="flex-1 px-2 py-1 rounded bg-slate-800" />
            <button onClick={submitComment} className="px-3 py-1 bg-blue-600 rounded">Comment</button>
          </div>
          <div className="max-h-32 overflow-auto text-sm space-y-1">
            {(selectedFile?.comments || []).map((item) => (
              <div key={item._id || `${item.text}-${item.createdAt}`} className="bg-slate-800 rounded px-2 py-1">{item.text}</div>
            ))}
          </div>
        </div>
      </main>

      <section className="xl:col-span-3 bg-slate-900 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold">Version History</h2>
        <div className="max-h-56 overflow-auto space-y-1 text-sm">
          {history.map((version) => (
            <div key={version._id} className="bg-slate-800 rounded px-2 py-1 flex items-center justify-between">
              <div>v{version.version} • {version.patchSummary}</div>
              <button onClick={() => restoreVersion(version.version)} className="text-xs text-emerald-300">Restore</button>
            </div>
          ))}
        </div>

        <h2 className="font-semibold">Audit Trail</h2>
        <div className="max-h-56 overflow-auto space-y-1 text-xs">
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
