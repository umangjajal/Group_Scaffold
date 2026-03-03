import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { socket, connectSocket } from '../socket';
import Editor from '@monaco-editor/react';
import { 
  FolderIcon, 
  DocumentIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  PlayIcon, 
  CloudArrowDownIcon, 
  ArrowPathIcon, 
  TrashIcon, 
  PlusIcon, 
  FolderPlusIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  XMarkIcon,
  CommandLineIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import ChatComponent from '../components/ChatComponent';
import MemberListComponent from '../components/MemberListComponent';
import '../styles/vscode.css';

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

const FileTreeItem = ({ item, level, onSelect, onItemDelete, selectedId, expandedFolders, toggleFolder }) => {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders[item.path];
    const paddingLeft = level * 12 + 10;

    if (isFolder) {
        return (
            <div>
                <div 
                    className="vscode-file-item" 
                    style={{ paddingLeft: `${paddingLeft}px` }}
                    onClick={() => toggleFolder(item.path)}
                >
                    {isExpanded ? <ChevronDownIcon className="w-4 h-4 mr-1" /> : <ChevronRightIcon className="w-4 h-4 mr-1" />}
                    <FolderIcon className="w-4 h-4 mr-1 text-blue-400" />
                    <span>{item.name}</span>
                </div>
                {isExpanded && Object.values(item.children).sort((a,b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                }).map(child => (
                    <FileTreeItem 
                        key={child.path || child._id} 
                        item={child} 
                        level={level + 1} 
                        onSelect={onSelect} 
                        onItemDelete={onItemDelete}
                        selectedId={selectedId}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                    />
                ))}
            </div>
        );
    }

    return (
        <div 
            className={`vscode-file-item group ${selectedId === item._id ? 'active' : ''}`}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => onSelect(item._id)}
        >
            <DocumentIcon className="w-4 h-4 mr-1 text-gray-400" />
            <span className="flex-1 overflow-hidden text-ellipsis">{item.name.split('/').pop()}</span>
            <button 
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm(`Delete ${item.name}?`)) onItemDelete(item._id);
                }}
            >
                <TrashIcon className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export default function Collaboration() {
  const { groupId } = useParams();
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({ 'root': true });
  const [githubUrl, setGithubUrl] = useState('');
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'members'

  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    connectSocket();
    fetchFiles();

    const onSnapshot = (payload) => {
      if (payload.fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), ...payload }));
    };

    const onPatched = ({ fileId, content, version }) => {
      if (fileId !== selectedFileId) return;
      setSelectedFile((current) => ({ ...(current || {}), content, version }));
    };

    socket.on('collab:file:snapshot', onSnapshot);
    socket.on('collab:file:patched', onPatched);

    return () => {
      socket.off('collab:file:snapshot', onSnapshot);
      socket.off('collab:file:patched', onPatched);
    };
  }, [selectedFileId, groupId]);

  useEffect(() => {
    async function initTerm() {
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
        if (!TerminalClass || !FitAddonClass) return;

        const term = new TerminalClass({ cursorBlink: true, fontSize: 13, theme: { background: '#1e1e1e' } });
        const fitAddon = new FitAddonClass();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        term.onData((data) => socket.emit('terminal:input', { data }));
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        socket.emit('terminal:start', { cols: term.cols, rows: term.rows, groupId });
      } catch (e) { setError(e.message); }
    }
    initTerm();

    const onTerminalData = (data) => xtermRef.current?.write(data);
    const onTerminalReady = () => {
        fitAddonRef.current?.fit();
        if(xtermRef.current) socket.emit('terminal:resize', { cols: xtermRef.current.cols, rows: xtermRef.current.rows });
    };

    socket.on('terminal:data', onTerminalData);
    socket.on('terminal:ready', onTerminalReady);

    return () => {
      socket.off('terminal:data', onTerminalData);
      socket.off('terminal:ready', onTerminalReady);
      socket.emit('terminal:stop');
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, [groupId]);

  const fileTree = useMemo(() => {
      const root = { name: 'Workspace', type: 'folder', children: {}, path: 'root' };
      files.forEach(file => {
          const parts = file.name.split('/');
          let current = root;
          let currentPath = 'root';
          parts.forEach((part, index) => {
              currentPath += '/' + part;
              if (index === parts.length - 1) {
                  current.children[part] = { ...file, type: 'file', path: currentPath };
              } else {
                  if (!current.children[part]) {
                      current.children[part] = { name: part, type: 'folder', children: {}, path: currentPath };
                  }
                  current = current.children[part];
              }
          });
      });
      return root;
  }, [files]);

  async function fetchFiles() {
    try {
      const { data } = await api.get(`/collab/groups/${groupId}/files`);
      setFiles(data);
      if (!selectedFileId && data[0]) selectFile(data[0]._id);
    } catch (e) { setError(e.response?.data?.error || 'Failed to fetch files.'); }
  }

  async function selectFile(fileId) {
    if (!fileId) return;
    try {
      setSelectedFileId(fileId);
      const { data } = await api.get(`/collab/files/${fileId}`);
      setSelectedFile(data);
      socket.emit('collab:file:join', { fileId });
    } catch (e) { setError(e.response?.data?.error || 'Failed to load file.'); }
  }

  async function createFile(name) {
    if (!name?.trim()) return;
    try {
      const { data } = await api.post(`/collab/groups/${groupId}/files`, { name: name.trim(), type: 'code' });
      await fetchFiles();
      await selectFile(data._id);
    } catch (err) { setError(err.response?.data?.error || 'Creation failed.'); }
  }

  async function deleteFile(fileId) {
      try {
          await api.delete(`/collab/files/${fileId}`);
          if(selectedFileId === fileId) {
              setSelectedFileId('');
              setSelectedFile(null);
          }
          await fetchFiles();
      } catch (err) { setError(err.response?.data?.error || 'Delete failed.'); }
  }

  async function saveFile() {
      if(!selectedFileId) return;
      try {
          await api.post(`/collab/files/${selectedFileId}/versions`, { patchSummary: 'Manual save' });
          setError('File saved successfully.');
          setTimeout(() => setError(''), 3000);
      } catch (err) { setError('Failed to save version.'); }
  }

  async function importGithub(e) {
      e.preventDefault();
      if (!githubUrl.trim()) return;
      setIsImporting(true);
      setError('');
      try {
          await api.post(`/collab/groups/${groupId}/github/import`, { repoUrl: githubUrl.trim() });
          setShowGithubModal(false);
          setGithubUrl('');
          await fetchFiles();
      } catch (err) {
          setError(err.response?.data?.error || 'GitHub import failed.');
      } finally {
          setIsImporting(false);
      }
  }

  async function syncFs() {
      try {
          await api.post(`/collab/groups/${groupId}/sync`);
          await fetchFiles();
      } catch (err) { setError(err.response?.data?.error || 'Sync failed.'); }
  }

  function onTextChange(nextValue) {
    if (!selectedFileId) return;
    socket.emit('collab:file:patch', { 
        fileId: selectedFileId, 
        delta: { from: 0, to: (selectedFile?.content?.text || '').length, text: nextValue }, 
        patchSummary: 'Live sync' 
    });
  }

  const toggleFolder = (path) => {
      setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleEditorMount = (editor) => {
      editorRef.current = editor;
  };

  const getLanguage = (filename) => {
    if(!filename) return 'javascript';
    const ext = filename.split('.').pop().toLowerCase();
    const map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', html: 'html', css: 'css', json: 'json', md: 'markdown' };
    return map[ext] || 'plaintext';
  };

  const handleUndo = () => editorRef.current?.trigger('keyboard', 'undo', null);
  const handleRedo = () => editorRef.current?.trigger('keyboard', 'redo', null);
  const handleFind = () => editorRef.current?.trigger('keyboard', 'actions.find', null);
  const handleReplace = () => editorRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction', null);

  return (
    <div className="vscode-layout">
      {/* Top Menu Bar */}
      <nav className="vscode-menubar">
          <div className="vscode-menubar-item">
            File
            <div className="vscode-dropdown">
                <div className="vscode-dropdown-item" onClick={() => { const n = prompt('New file path:'); if(n) createFile(n); }}>New File</div>
                <div className="vscode-dropdown-item" onClick={() => { const n = prompt('New folder path:'); if(n) createFile(`${n}/.keep`); }}>New Folder</div>
                <div className="vscode-dropdown-divider" />
                <div className="vscode-dropdown-item" onClick={saveFile}>Save</div>
                <div className="vscode-dropdown-divider" />
                <div className="vscode-dropdown-item" onClick={syncFs}>Sync Filesystem</div>
                <div className="vscode-dropdown-item" onClick={() => setShowGithubModal(true)}>Import GitHub...</div>
            </div>
          </div>
          <div className="vscode-menubar-item">
            Edit
            <div className="vscode-dropdown">
                <div className="vscode-dropdown-item" onClick={handleUndo}>Undo</div>
                <div className="vscode-dropdown-item" onClick={handleRedo}>Redo</div>
                <div className="vscode-dropdown-divider" />
                <div className="vscode-dropdown-item" onClick={handleFind}>Find</div>
                <div className="vscode-dropdown-item" onClick={handleReplace}>Replace</div>
            </div>
          </div>
          <div className="vscode-menubar-item">
            View
            <div className="vscode-dropdown">
                <div className="vscode-dropdown-item" onClick={() => setLeftSidebarVisible(!leftSidebarVisible)}>Toggle Explorer</div>
                <div className="vscode-dropdown-item" onClick={() => setRightSidebarVisible(!rightSidebarVisible)}>Toggle Right Sidebar</div>
                <div className="vscode-dropdown-divider" />
                <div className="vscode-dropdown-item" onClick={() => {
                  if(!document.fullscreenElement) document.documentElement.requestFullscreen();
                  else document.exitFullscreen();
                }}>Full Screen</div>
            </div>
          </div>
          <div className="vscode-menubar-item">
            Run
            <div className="vscode-dropdown">
                <div className="vscode-dropdown-item" onClick={() => socket.emit('terminal:input', { data: 'npm start\r' })}>Run Debugging</div>
                <div className="vscode-dropdown-item" onClick={() => socket.emit('terminal:input', { data: 'npm test\r' })}>Run Tests</div>
                <div className="vscode-dropdown-item" onClick={() => socket.emit('terminal:input', { data: 'npm run build\r' })}>Build Project</div>
            </div>
          </div>
          <div className="vscode-menubar-item text-green-400 font-bold flex items-center gap-1" onClick={() => window.open(`/call/${groupId}`, '_blank')}>
              <VideoCameraIcon className="w-4 h-4" /> Start Video Call
          </div>
          <div className="flex-1" />
          {error && <div className="text-xs mr-4 px-2 py-1 rounded bg-blue-900/30 text-blue-300 animate-pulse">{error}</div>}
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        {leftSidebarVisible && (
          <aside className="vscode-sidebar">
            <div className="vscode-sidebar-header flex justify-between items-center">
                <span>EXPLORER</span>
                <div className="flex gap-2">
                    <button onClick={() => {
                        const name = prompt('Enter file name (can include paths, e.g. src/index.js)');
                        if(name) createFile(name);
                    }} title="New File" className="hover:text-blue-400"><DocumentIcon className="w-4 h-4" /></button>
                    <button onClick={() => {
                        const name = prompt('Enter folder name:');
                        if(name) createFile(`${name}/.keep`);
                    }} title="New Folder" className="hover:text-blue-400"><FolderPlusIcon className="w-4 h-4" /></button>
                    <button onClick={syncFs} title="Refresh/Sync" className="hover:text-blue-400"><ArrowPathIcon className="w-4 h-4" /></button>
                </div>
            </div>
            <div className="vscode-sidebar-content">
              <FileTreeItem 
                  item={fileTree} 
                  level={0} 
                  onSelect={selectFile} 
                  onItemDelete={deleteFile}
                  selectedId={selectedFileId} 
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
              />
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="vscode-main">
          <div className="vscode-editor-area">
            <div className="vscode-tabs">
              {selectedFile && <div className="vscode-tab active">{selectedFile.name.split('/').pop()}</div>}
            </div>
            <div className="flex-1 relative overflow-hidden">
              {selectedFile ? (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={selectedFile.name}
                  language={getLanguage(selectedFile.name)}
                  value={selectedFile.content?.text || ''}
                  onMount={handleEditorMount}
                  onChange={(v) => onTextChange(v || '')}
                  options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, wordWrap: 'on' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                  <DocumentIcon className="w-16 h-16 opacity-10" />
                  <p>Select a file to start coding</p>
                </div>
              )}
            </div>
          </div>

          <div className="vscode-terminal-area">
            <div className="vscode-terminal-header">TERMINAL</div>
            <div ref={terminalRef} className="flex-1 p-1 overflow-hidden" />
          </div>
        </main>

        {/* Right Sidebar (Chat & Members) */}
        {rightSidebarVisible && (
          <aside className="w-[320px] bg-[#252526] border-l border-[#333] flex flex-col overflow-hidden">
            <div className="flex items-center justify-around border-b border-[#333] bg-[#2d2d2d]">
              <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'chat' ? 'bg-[#1e1e1e] text-blue-400 border-b border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" /> Chat
              </button>
              <button 
                onClick={() => setActiveTab('members')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'members' ? 'bg-[#1e1e1e] text-blue-400 border-b border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <UsersIcon className="w-4 h-4" /> Members
              </button>
              <button onClick={() => setRightSidebarVisible(false)} className="px-3 text-gray-500 hover:text-red-400">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' ? <ChatComponent groupId={groupId} /> : <MemberListComponent groupId={groupId} />}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Call Button if not in call page */}
      <div className="fixed bottom-6 right-6">
          <button 
            className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            onClick={() => window.open(`/call/${groupId}`, '_blank')}
          >
            <VideoCameraIcon className="w-7 h-7" />
          </button>
      </div>

      {/* GitHub Import Modal */}
      {showGithubModal && (
          <div className="modal-overlay">
              <div className="modal-card p-6">
                  <h2 className="text-xl font-bold mb-2">Import from GitHub</h2>
                  <p className="text-sm text-gray-400 mb-4">Enter a public repository URL to clone it into your workspace.</p>
                  <form onSubmit={importGithub}>
                      <input 
                        className="vscode-input mb-4" 
                        placeholder="https://github.com/user/repo.git" 
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                          <button type="button" className="btn btn--ghost" onClick={() => setShowGithubModal(false)}>Cancel</button>
                          <button type="submit" className="btn btn--primary" disabled={isImporting}>
                              {isImporting ? 'Cloning...' : 'Clone Repo'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
