import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { socket, connectSocket } from '../socket';
import Editor, { DiffEditor } from '@monaco-editor/react';
import {
  FolderIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CloudArrowDownIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  FolderPlusIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  XMarkIcon,
  Square2StackIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import ChatComponent from '../components/ChatComponent';
import MemberListComponent from '../components/MemberListComponent';
import '../styles/vscode.css';

const SourceControlView = ({ groupId, onOpenDiff }) => {
  const [status, setStatus] = useState([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(null); // 'commit', 'push', 'pull' or null
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const { data } = await api.get(`/collab/groups/${groupId}/git/status`);
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [groupId]);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setLoading('commit');
    setError('');
    try {
      await api.post(`/collab/groups/${groupId}/git/commit`, { commitMessage: commitMsg });
      setCommitMsg('');
      await fetchStatus();
    } catch (e) {
      setError(e.response?.data?.error || 'Commit failed');
    } finally {
      setLoading(null);
    }
  };

  const handlePush = async () => {
    setLoading('push');
    setError('');
    try {
      await api.post('/collab/git/push', { groupId });
      alert('Pushed successfully!');
    } catch (e) {
      setError(e.response?.data?.error || 'Push failed');
    } finally {
      setLoading(null);
    }
  };

  const handlePull = async () => {
    setLoading('pull');
    setError('');
    try {
      await api.post(`/collab/groups/${groupId}/git/pull`);
      await fetchStatus();
      alert('Pulled successfully!');
    } catch (e) {
      setError(e.response?.data?.error || 'Pull failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#252526] font-sans">
      <div className="p-4 flex flex-col gap-3 border-b border-[#333]">
        <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold tracking-wider">
          <span>Source Control</span>
          <button
            onClick={handlePull}
            disabled={!!loading}
            className="hover:text-white"
            title="Pull"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${loading === 'pull' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <textarea
          className="vscode-input h-20 resize-none text-xs bg-[#3c3c3c] border-none focus:ring-1 focus:ring-[#007acc] rounded p-2"
          placeholder="Commit message..."
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="btn btn--primary flex-1 py-1.5 text-xs font-medium rounded transition-all"
            disabled={!!loading || status.length === 0 || !commitMsg.trim()}
            onClick={handleCommit}
          >
            {loading === 'commit' ? '...' : 'Commit'}
          </button>
          <button
            className="btn btn--ghost flex-1 py-1.5 text-xs font-medium rounded border-[#444] hover:bg-[#333] transition-all"
            disabled={!!loading}
            onClick={handlePush}
          >
            {loading === 'push' ? '...' : 'Push'}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
      </div>

      <div className="vscode-sidebar-header flex justify-between items-center px-4 py-2 text-[10px] text-gray-400 uppercase font-bold bg-[#2d2d2d]">
        <span>Changes ({status.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {status.map((s, idx) => (
          <div
            key={idx}
            className="vscode-file-item group flex items-center gap-3 px-4 py-1.5 hover:bg-[#2a2d2e] cursor-pointer"
            onClick={() => onOpenDiff(s.name)}
          >
            <span
              className={`text-[10px] font-bold w-4 text-center ${s.status === 'M' ? 'text-yellow-500' : 'text-green-500'}`}
            >
              {s.status}
            </span>
            <span className="flex-1 overflow-hidden text-ellipsis text-xs text-gray-300">
              {s.name}
            </span>
          </div>
        ))}
        {status.length === 0 && (
          <div className="p-6 text-xs text-gray-500 italic text-center">No changes detected.</div>
        )}
      </div>
    </div>
  );
};

const FileTreeItem = ({
  item,
  level,
  onSelect,
  onItemDelete,
  selectedId,
  expandedFolders,
  toggleFolder,
}) => {
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
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 mr-1" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 mr-1" />
          )}
          <FolderIcon className="w-4 h-4 mr-1 text-blue-400" />
          <span>{item.name}</span>
        </div>
        {isExpanded &&
          Object.values(item.children)
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            })
            .map((child) => (
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
          if (window.confirm(`Delete ${item.name}?`)) onItemDelete(item._id);
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
  const [expandedFolders, setExpandedFolders] = useState({ root: true });
  const [githubUrl, setGithubUrl] = useState('');
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'members'
  const [activeSidebar, setActiveSidebar] = useState('explorer'); // 'explorer', 'git'
  const [diffFile, setDiffFile] = useState(null); // { name, original, current }
  const [userRepos, setUserRepos] = useState([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);

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

  const fetchRepos = async () => {
    setFetchingRepos(true);
    try {
      const { data } = await api.get('/auth/github/repos');
      setUserRepos(data);
    } catch (e) {
      console.error('Failed to fetch repos', e);
    } finally {
      setFetchingRepos(false);
    }
  };

  const openDiff = async (fileName) => {
    try {
      const { data } = await api.get(`/collab/groups/${groupId}/git/diff?file=${fileName}`);
      setDiffFile({ name: fileName, ...data });
      setSelectedFile(null);
      setSelectedFileId('');
    } catch (e) {
      setError('Failed to fetch diff');
    }
  };

  const fileTree = useMemo(() => {
    const root = { name: 'Workspace', type: 'folder', children: {}, path: 'root' };
    files.forEach((file) => {
      const parts = file.name.split('/');
      let current = root;
      let currentPath = 'root';
      parts.forEach((part, index) => {
        currentPath += '/' + part;
        if (index === parts.length - 1) {
          current.children[part] = { ...file, type: 'file', path: currentPath };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'folder',
              children: {},
              path: currentPath,
            };
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
      if (!selectedFileId && data[0] && !diffFile) selectFile(data[0]._id);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to fetch files.');
    }
  }

  async function selectFile(fileId) {
    if (!fileId) return;
    try {
      setDiffFile(null);
      setSelectedFileId(fileId);
      const { data } = await api.get(`/collab/files/${fileId}`);
      setSelectedFile(data);
      socket.emit('collab:file:join', { fileId });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load file.');
    }
  }

  async function createFile(name) {
    if (!name?.trim()) return;
    try {
      const { data } = await api.post(`/collab/groups/${groupId}/files`, {
        name: name.trim(),
        type: 'code',
      });
      await fetchFiles();
      await selectFile(data._id);
    } catch (err) {
      setError(err.response?.data?.error || 'Creation failed.');
    }
  }

  async function deleteFile(fileId) {
    try {
      await api.delete(`/collab/files/${fileId}`);
      if (selectedFileId === fileId) {
        setSelectedFileId('');
        setSelectedFile(null);
      }
      await fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  }

  async function saveFile() {
    if (!selectedFileId) return;
    try {
      await api.post(`/collab/files/${selectedFileId}/versions`, { patchSummary: 'Manual save' });
      setError('File saved successfully.');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError('Failed to save version.');
    }
  }

  async function importGithub(e, repoFullname = null) {
    if (e) e.preventDefault();
    const payload = repoFullname ? { repoFullname } : { repoUrl: githubUrl.trim() };
    if (!payload.repoFullname && !payload.repoUrl) return;

    setIsImporting(true);
    setError('');
    try {
      await api.post(`/collab/groups/${groupId}/github/import`, payload);
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
    } catch (err) {
      setError(err.response?.data?.error || 'Sync failed.');
    }
  }

  function onTextChange(nextValue) {
    if (!selectedFileId) return;
    socket.emit('collab:file:patch', {
      fileId: selectedFileId,
      delta: { from: 0, to: (selectedFile?.content?.text || '').length, text: nextValue },
      patchSummary: 'Live sync',
    });
  }

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  const getLanguage = (filename) => {
    if (!filename) return 'javascript';
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
    };
    return map[ext] || 'plaintext';
  };

  const handleUndo = () => editorRef.current?.trigger('keyboard', 'undo', null);
  const handleRedo = () => editorRef.current?.trigger('keyboard', 'redo', null);
  const handleFind = () => editorRef.current?.trigger('keyboard', 'actions.find', null);
  const handleReplace = () =>
    editorRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction', null);

  return (
    <div className="vscode-layout">
      {/* Top Menu Bar */}
      <nav className="vscode-menubar">
        <div className="vscode-menubar-item">
          File
          <div className="vscode-dropdown">
            <div
              className="vscode-dropdown-item"
              onClick={() => {
                const n = prompt('New file path:');
                if (n) createFile(n);
              }}
            >
              New File
            </div>
            <div
              className="vscode-dropdown-item"
              onClick={() => {
                const n = prompt('New folder path:');
                if (n) createFile(`${n}/.keep`);
              }}
            >
              New Folder
            </div>
            <div className="vscode-dropdown-divider" />
            <div className="vscode-dropdown-item" onClick={saveFile}>
              Save
            </div>
            <div className="vscode-dropdown-divider" />
            <div className="vscode-dropdown-item" onClick={syncFs}>
              Sync Filesystem
            </div>
            <div
              className="vscode-dropdown-item"
              onClick={() => {
                setShowGithubModal(true);
                fetchRepos();
              }}
            >
              Open GitHub Repo...
            </div>
          </div>
        </div>
        <div className="vscode-menubar-item">
          Edit
          <div className="vscode-dropdown">
            <div className="vscode-dropdown-item" onClick={handleUndo}>
              Undo
            </div>
            <div className="vscode-dropdown-item" onClick={handleRedo}>
              Redo
            </div>
            <div className="vscode-dropdown-divider" />
            <div className="vscode-dropdown-item" onClick={handleFind}>
              Find
            </div>
            <div className="vscode-dropdown-item" onClick={handleReplace}>
              Replace
            </div>
          </div>
        </div>
        <div className="vscode-menubar-item">
          View
          <div className="vscode-dropdown">
            <div
              className="vscode-dropdown-item"
              onClick={() => setLeftSidebarVisible(!leftSidebarVisible)}
            >
              Toggle Explorer
            </div>
            <div
              className="vscode-dropdown-item"
              onClick={() => setRightSidebarVisible(!rightSidebarVisible)}
            >
              Toggle Right Sidebar
            </div>
            <div className="vscode-dropdown-divider" />
            <div
              className="vscode-dropdown-item"
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen();
              }}
            >
              Full Screen
            </div>
          </div>
        </div>
        <div className="flex-1" />
        {error && (
          <div className="text-xs mr-4 px-2 py-1 rounded bg-blue-900/30 text-blue-300 animate-pulse">
            {error}
          </div>
        )}
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-4 gap-4 border-r border-[#1e1e1e]">
          <button
            onClick={() => {
              setLeftSidebarVisible(true);
              setActiveSidebar('explorer');
            }}
            className={`p-2 transition-colors ${leftSidebarVisible && activeSidebar === 'explorer' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Explorer"
          >
            <Square2StackIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setLeftSidebarVisible(true);
              setActiveSidebar('git');
            }}
            className={`p-2 transition-colors ${leftSidebarVisible && activeSidebar === 'git' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Source Control"
          >
            <QueueListIcon className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => {
              setRightSidebarVisible(true);
              setActiveTab('chat');
            }}
            className={`p-2 transition-colors ${rightSidebarVisible && activeTab === 'chat' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Chat"
          >
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setRightSidebarVisible(true);
              setActiveTab('members');
            }}
            className={`p-2 transition-colors ${rightSidebarVisible && activeTab === 'members' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Members"
          >
            <UsersIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar */}
        {leftSidebarVisible && (
          <aside className="vscode-sidebar">
            {activeSidebar === 'explorer' ? (
              <>
                <div className="vscode-sidebar-header flex justify-between items-center">
                  <span>EXPLORER</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const name = prompt(
                          'Enter file name (can include paths, e.g. src/index.js)',
                        );
                        if (name) createFile(name);
                      }}
                      title="New File"
                      className="hover:text-blue-400"
                    >
                      <DocumentIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const name = prompt('Enter folder name:');
                        if (name) createFile(`${name}/.keep`);
                      }}
                      title="New Folder"
                      className="hover:text-blue-400"
                    >
                      <FolderPlusIcon className="w-4 h-4" />
                    </button>
                    <button onClick={syncFs} title="Refresh/Sync" className="hover:text-blue-400">
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
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
              </>
            ) : (
              <SourceControlView groupId={groupId} onOpenDiff={openDiff} />
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className="vscode-main">
          <div className="vscode-editor-area">
            <div className="vscode-tabs">
              {selectedFile && (
                <div className="vscode-tab active">{selectedFile.name.split('/').pop()}</div>
              )}
              {diffFile && (
                <div className="vscode-tab active">Diff: {diffFile.name.split('/').pop()}</div>
              )}
            </div>
            <div className="flex-1 relative overflow-hidden">
              {diffFile ? (
                <DiffEditor
                  height="100%"
                  theme="vs-dark"
                  original={diffFile.original}
                  modified={diffFile.current}
                  language={getLanguage(diffFile.name)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    automaticLayout: true,
                    readOnly: true,
                  }}
                />
              ) : selectedFile ? (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={selectedFile.name}
                  language={getLanguage(selectedFile.name)}
                  value={selectedFile.content?.text || ''}
                  onMount={handleEditorMount}
                  onChange={(v) => onTextChange(v || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                  <DocumentIcon className="w-16 h-16 opacity-10" />
                  <p>Select a file to start coding</p>
                </div>
              )}
            </div>
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
              <button
                onClick={() => setRightSidebarVisible(false)}
                className="px-3 text-gray-500 hover:text-red-400"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' ? (
                <ChatComponent groupId={groupId} />
              ) : (
                <MemberListComponent groupId={groupId} />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* GitHub Import Modal */}
      {showGithubModal && (
        <div className="modal-overlay">
          <div className="modal-card p-6 max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-2">Import from GitHub</h2>

            <div className="flex-1 overflow-y-auto mb-4">
              <p className="text-xs text-gray-400 mb-2">MY REPOSITORIES</p>
              {fetchingRepos ? (
                <div className="text-xs animate-pulse">Fetching repositories...</div>
              ) : (
                <div className="grid gap-1">
                  {userRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-2 hover:bg-[#2a2d2e] cursor-pointer rounded flex items-center justify-between border border-transparent hover:border-[#007acc]"
                      onClick={() => importGithub(null, repo.full_name)}
                    >
                      <div>
                        <div className="text-sm font-medium text-blue-400">{repo.name}</div>
                        <div className="text-[10px] text-gray-500">{repo.full_name}</div>
                      </div>
                      {repo.private && (
                        <span className="text-[8px] px-1 bg-gray-700 rounded text-gray-300 uppercase">
                          Private
                        </span>
                      )}
                    </div>
                  ))}
                  {userRepos.length === 0 && (
                    <div className="text-xs text-gray-500 italic">No repositories found.</div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[#333] pt-4">
              <p className="text-sm text-gray-400 mb-2">Or enter a public repository URL:</p>
              <form onSubmit={importGithub}>
                <input
                  className="vscode-input mb-4"
                  placeholder="https://github.com/user/repo.git"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowGithubModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={isImporting}>
                    {isImporting ? 'Cloning...' : 'Clone Repo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
