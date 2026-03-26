import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { createSocketConnection } from '../socket';
import { useAuth } from '../contexts/AuthContext';
import realtimeLogo from '../assets/realtimeLogo';
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import '../styles/room.css';

export default function RoomDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const participantsRef = useRef([]);

  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState([]);
  const [groupName, setGroupName] = useState('');

  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaError, setMediaError] = useState('');

  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [remoteStates, setRemoteStates] = useState({}); // peerId -> { cameraOn, micOn }

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');

  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    bootstrapRoom();
    return () => {
      leaveMeeting();
      if (socketRef.current) {
        socketRef.current.emit('rtc:leave-room', { roomId });
        socketRef.current.emit('leave', { groupId: roomId });
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, [roomId]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = cameraOn));
    stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    socketRef.current?.emit('call:track-state', {
      sessionId: roomId,
      type: 'video',
      enabled: cameraOn,
    });
    socketRef.current?.emit('call:track-state', {
      sessionId: roomId,
      type: 'audio',
      enabled: micOn,
    });
  }, [cameraOn, micOn, roomId]);

  async function bootstrapRoom() {
    try {
      setLoading(true);
      const res = await api.get(`/groups/${roomId}`);
      setGroupName(res.data.name);

      const membersRes = await api.get(`/groups/${roomId}/members`);
      const groupMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
      setMembers(groupMembers);

      if (!groupMembers.some((m) => m.user?._id === user?.id)) {
        await api.post(`/groups/${roomId}/join`);
      }

      setIsMember(true);
      await setupLocalMedia();
      initializeSocket();
    } catch (error) {
      console.error('Room bootstrap error:', error);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }

  async function setupLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      setMediaError(`Camera/Mic unavailable: ${error.message}`);
    }
  }

  function initializeSocket() {
    const socket = createSocketConnection();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { groupId: roomId });
      socket.emit('meeting:join', { groupId: roomId });
      socket.emit('task:list', { groupId: roomId });
    });

    socket.on('message:new', (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          id: msg._id,
          text: msg.text,
          sender: msg.sender,
          timestamp: new Date(msg.createdAt),
        },
      ]);
    });

    socket.on('meeting:participants', ({ participants: existingPeers }) => {
      setParticipants(existingPeers || []);
      participantsRef.current = existingPeers || [];
      existingPeers?.forEach((peer) => createPeerConnection(peer.id, peer.name, true));
    });

    socket.on('meeting:peer-joined', ({ peer }) => {
      setParticipants((prev) => (prev.some((p) => p.id === peer.id) ? prev : [...prev, peer]));
      participantsRef.current = [...participantsRef.current, peer];
      createPeerConnection(peer.id, peer.name, false);
    });

    socket.on('meeting:signal', ({ from, signal }) => handleMeetingSignal(from, signal));

    socket.on('call:track-state', ({ userId, type, enabled }) => {
      setRemoteStates((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [type === 'video' ? 'cameraOn' : 'micOn']: enabled },
      }));
    });

    socket.on('meeting:peer-left', ({ peerId }) => {
      removePeer(peerId);
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      participantsRef.current = participantsRef.current.filter((p) => p.id !== peerId);
    });

    socket.on('task:list', ({ tasks: t }) => setTasks(t || []));
    socket.on('task:upsert', ({ task }) => {
      setTasks((prev) =>
        prev.some((i) => i.id === task.id)
          ? prev.map((i) => (i.id === task.id ? task : i))
          : [task, ...prev],
      );
    });
    socket.on('task:delete', ({ taskId }) =>
      setTasks((prev) => prev.filter((t) => t.id !== taskId)),
    );
  }

  async function createPeerConnection(peerId, peerName, initiator) {
    if (!peerId || peerConnectionsRef.current.has(peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => {
        if (prev.find((i) => i.peerId === peerId)) return prev;
        return [...prev, { peerId, name: peerName || 'Participant', stream: e.streams[0] }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate)
        socketRef.current?.emit('meeting:signal', {
          groupId: roomId,
          to: peerId,
          signal: { candidate: e.candidate },
        });
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('meeting:signal', {
        groupId: roomId,
        to: peerId,
        signal: { sdp: pc.localDescription },
      });
    }
  }

  async function handleMeetingSignal(from, signal) {
    if (!peerConnectionsRef.current.has(from)) {
      const p = participantsRef.current.find((i) => i.id === from);
      await createPeerConnection(from, p?.name, false);
    }
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('meeting:signal', {
          groupId: roomId,
          to: from,
          signal: { sdp: pc.localDescription },
        });
      }
    }
    if (signal.candidate) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }

  function removePeer(peerId) {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) pc.close();
    peerConnectionsRef.current.delete(peerId);
    setRemoteStreams((prev) => prev.filter((i) => i.peerId !== peerId));
  }

  function leaveMeeting() {
    socketRef.current?.emit('meeting:leave', { groupId: roomId });
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams([]);
    setParticipants([]);
  }

  function sendMessage() {
    if (!messageInput.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { groupId: roomId, text: messageInput.trim() });
    setMessageInput('');
  }

  function createTask() {
    if (!taskInput.trim() || !socketRef.current) return;
    socketRef.current.emit('task:create', { groupId: roomId, title: taskInput.trim() });
    setTaskInput('');
  }

  const startResizing = () => setIsResizing(true);
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < window.innerWidth * 0.8) setSidebarWidth(newWidth);
    };
    const stopResizing = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  if (loading)
    return (
      <div className="h-screen bg-[#f8fafc] flex items-center justify-center text-blue-600 font-bold tracking-widest uppercase text-xs animate-pulse">
        Initializing Room Dashboard...
      </div>
    );

  return (
    <div className="room-dashboard theme-hybrid">
      {/* Main Content: Video Stage */}
      <div className="room-main-stage">
        <header className="room-header">
          <div className="room-logo-box">
            <div className="room-logo-icon">
              <img src={realtimeLogo} alt="Logo" className="w-5 h-5 invert" />
            </div>
            <div className="room-title-area">
              <h1>{groupName}</h1>
              <p>Live Collaboration Hub</p>
            </div>
          </div>

          <div className="room-controls">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`control-btn ${!micOn ? 'active-danger' : ''}`}
              title={micOn ? 'Mute Mic' : 'Unmute Mic'}
            >
              {micOn ? (
                <MicrophoneIcon className="w-5 h-5" />
              ) : (
                <div className="relative">
                  <MicrophoneIcon className="w-5 h-5" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-[1.5px] bg-white rotate-45" />
                  </div>
                </div>
              )}
            </button>
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className={`control-btn ${!cameraOn ? 'active-danger' : ''}`}
              title={cameraOn ? 'Stop Camera' : 'Start Camera'}
            >
              {cameraOn ? (
                <VideoCameraIcon className="w-5 h-5" />
              ) : (
                <VideoCameraSlashIcon className="w-5 h-5" />
              )}
            </button>
            <div className="h-6 w-[1px] bg-gray-300 dark:bg-gray-700 mx-1" />
            <button
              onClick={() => navigate(`/groups/${roomId}/collab`)}
              className="control-btn active-primary px-4 py-2 text-xs font-bold gap-2"
            >
              <CommandLineIcon className="w-4 h-4" /> Open Workspace
            </button>
            <button
              onClick={() => navigate('/groups')}
              className="control-btn text-red-500 hover:bg-red-50"
              title="Leave Room"
            >
              <PhoneXMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="room-content">
          <div className="video-grid">
            <VideoCard
              title="You (Local)"
              isMe
              muted
              videoRef={localVideoRef}
              stream={localStream}
              cameraOn={cameraOn}
              micOn={micOn}
              user={user}
            />
            {remoteStreams.map((peer) => (
              <VideoCard
                key={peer.peerId}
                title={peer.name}
                stream={peer.stream}
                cameraOn={remoteStates[peer.peerId]?.cameraOn ?? true}
                micOn={remoteStates[peer.peerId]?.micOn ?? true}
                user={{ name: peer.name }}
              />
            ))}
          </div>

          {mediaError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-medium">
              {mediaError}
            </div>
          )}
        </main>
      </div>

      {/* Resize Handle */}
      <div
        className="w-1.5 cursor-col-resize bg-transparent hover:bg-blue-600/50 transition-colors"
        onMouseDown={startResizing}
      />

      {/* Resizable Sidebar */}
      <aside className="room-sidebar" style={{ width: sidebarWidth }}>
        {/* Chat Section */}
        <section className="chat-area border-b border-gray-100 dark:border-gray-800">
          <div className="sidebar-section-header">
            <div className="section-title">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" /> Live Chat
            </div>
          </div>
          <div className="chat-messages">
            {messages.map((m, i) => {
              const isMe = m.sender?._id === user?.id || m.sender === user?.id;
              return (
                <div
                  key={m.id || i}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  {!isMe && (
                    <span className="text-[10px] font-bold text-blue-500 mb-1 ml-1">
                      {m.sender?.name || m.sender}
                    </span>
                  )}
                  <div className={`chat-bubble ${isMe ? 'me' : 'them'}`}>{m.text}</div>
                </div>
              );
            })}
          </div>
          <div className="chat-input-box">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="input-wrapper"
            >
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button
                type="submit"
                className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </section>

        {/* Workspace Context Section */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="sidebar-section-header bg-gray-50/50 dark:bg-gray-800/30">
            <div className="section-title">Workspace Context</div>
          </div>
          <div className="sidebar-tabs">
            {/* Task Board */}
            <div className="mb-8">
              <h4 className="section-title mb-4">
                <ClipboardDocumentListIcon className="w-4 h-4" /> Task Board
              </h4>
              <div className="flex gap-2 mb-4">
                <input
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Quick task..."
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                />
                <button
                  onClick={createTask}
                  className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {tasks.map((t) => (
                  <div key={t.id} className="task-item group">
                    <button
                      onClick={() =>
                        socketRef.current?.emit('task:toggle', {
                          groupId: roomId,
                          taskId: t.id,
                          completed: !t.completed,
                        })
                      }
                      className={`task-checkbox ${t.completed ? 'completed' : ''}`}
                    >
                      {t.completed && <CheckCircleIcon className="w-4 h-4" />}
                    </button>
                    <span
                      className={`flex-1 text-xs font-medium ${t.completed ? 'text-gray-400 line-through' : ''}`}
                    >
                      {t.title}
                    </span>
                    <button
                      onClick={() =>
                        socketRef.current?.emit('task:delete', { groupId: roomId, taskId: t.id })
                      }
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-[10px] text-gray-500 italic py-4 text-center">
                    No active tasks
                  </p>
                )}
              </div>
            </div>

            {/* Members */}
            <div>
              <h4 className="section-title mb-4">
                <UsersIcon className="w-4 h-4" /> Room Members ({members.length})
              </h4>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m._id} className="member-item">
                    <div className="member-avatar">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{m.user?.name}</span>
                      <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">
                        {m.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function VideoCard({
  title,
  stream,
  isMe = false,
  muted = false,
  videoRef,
  cameraOn,
  micOn,
  user,
}) {
  const internalVideoRef = useRef(null);
  const ref = videoRef || internalVideoRef;

  useEffect(() => {
    if (stream && ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream, ref, cameraOn]);

  return (
    <article className="video-card">
      {cameraOn ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="video-placeholder">
          <div className="video-avatar">
            <UserIcon className="w-8 h-8 md:w-10 md:h-10" />
          </div>
          <span className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-tight">
            {user?.name}
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="video-label">
          {title} {isMe ? '(You)' : ''}
        </div>
        <div className="flex gap-2">
          {!micOn && (
            <div className="p-1.5 bg-red-500/80 backdrop-blur-md rounded-lg">
              <div className="relative">
                <MicrophoneIcon className="w-3 h-3 text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-white rotate-45" />
                </div>
              </div>
            </div>
          )}
          {!cameraOn && (
            <div className="p-1.5 bg-red-500/80 backdrop-blur-md rounded-lg">
              <VideoCameraSlashIcon className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
