import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
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
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

  const token = localStorage.getItem('accessToken');
  const axiosAuth = useMemo(() => axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  }), [token]);

  useEffect(() => {
    bootstrapRoom();
    return () => {
      leaveMeeting();
      if (socketRef.current) {
        socketRef.current.emit('rtc:leave-room', { roomId });
        socketRef.current.emit('leave', { groupId: roomId });
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      peerConnectionsRef.current.forEach(pc => pc.close());
    };
  }, [roomId]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => t.enabled = cameraOn);
    stream.getAudioTracks().forEach(t => t.enabled = micOn);
    socketRef.current?.emit('call:track-state', { sessionId: roomId, type: 'video', enabled: cameraOn });
    socketRef.current?.emit('call:track-state', { sessionId: roomId, type: 'audio', enabled: micOn });
  }, [cameraOn, micOn, roomId]);

  async function bootstrapRoom() {
    try {
      setLoading(true);
      const res = await axiosAuth.get(`/api/groups/${roomId}`);
      setGroupName(res.data.name);
      
      const membersRes = await axiosAuth.get(`/api/groups/${roomId}/members`);
      const groupMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
      setMembers(groupMembers);

      if (!groupMembers.some(m => m.user?._id === user?.id)) {
        await axiosAuth.post(`/api/groups/${roomId}/join`);
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
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) { setMediaError(`Camera/Mic unavailable: ${error.message}`); }
  }

  function initializeSocket() {
    const socket = io(API_URL, { auth: { token: localStorage.getItem('accessToken') } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { groupId: roomId });
      socket.emit('meeting:join', { groupId: roomId });
      socket.emit('task:list', { groupId: roomId });
    });

    socket.on('message:new', (msg) => {
      setMessages(prev => [...prev, {
        id: msg._id,
        text: msg.text,
        sender: msg.sender,
        timestamp: new Date(msg.createdAt),
      }]);
    });

    socket.on('meeting:participants', ({ participants: existingPeers }) => {
      setParticipants(existingPeers || []);
      participantsRef.current = existingPeers || [];
      existingPeers?.forEach(peer => createPeerConnection(peer.id, peer.name, true));
    });

    socket.on('meeting:peer-joined', ({ peer }) => {
      setParticipants(prev => prev.some(p => p.id === peer.id) ? prev : [...prev, peer]);
      participantsRef.current = [...participantsRef.current, peer];
      createPeerConnection(peer.id, peer.name, false);
    });

    socket.on('meeting:signal', ({ from, signal }) => handleMeetingSignal(from, signal));
    
    socket.on('call:track-state', ({ userId, type, enabled }) => {
        setRemoteStates(prev => ({ ...prev, [userId]: { ...prev[userId], [type === 'video' ? 'cameraOn' : 'micOn']: enabled } }));
    });

    socket.on('meeting:peer-left', ({ peerId }) => {
      removePeer(peerId);
      setParticipants(prev => prev.filter(p => p.id !== peerId));
      participantsRef.current = participantsRef.current.filter(p => p.id !== peerId);
    });

    socket.on('task:list', ({ tasks: t }) => setTasks(t || []));
    socket.on('task:upsert', ({ task }) => {
      setTasks(prev => prev.some(i => i.id === task.id) ? prev.map(i => i.id === task.id ? task : i) : [task, ...prev]);
    });
    socket.on('task:delete', ({ taskId }) => setTasks(prev => prev.filter(t => t.id !== taskId)));
  }

  async function createPeerConnection(peerId, peerName, initiator) {
    if (!peerId || peerConnectionsRef.current.has(peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    pc.ontrack = (e) => {
      setRemoteStreams(prev => {
        if (prev.find(i => i.peerId === peerId)) return prev;
        return [...prev, { peerId, name: peerName || 'Participant', stream: e.streams[0] }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('meeting:signal', { groupId: roomId, to: peerId, signal: { candidate: e.candidate } });
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('meeting:signal', { groupId: roomId, to: peerId, signal: { sdp: pc.localDescription } });
    }
  }

  async function handleMeetingSignal(from, signal) {
    if (!peerConnectionsRef.current.has(from)) {
      const p = participantsRef.current.find(i => i.id === from);
      await createPeerConnection(from, p?.name, false);
    }
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('meeting:signal', { groupId: roomId, to: from, signal: { sdp: pc.localDescription } });
      }
    }
    if (signal.candidate) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }

  function removePeer(peerId) {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) pc.close();
    peerConnectionsRef.current.delete(peerId);
    setRemoteStreams(prev => prev.filter(i => i.peerId !== peerId));
  }

  function leaveMeeting() {
    socketRef.current?.emit('meeting:leave', { groupId: roomId });
    peerConnectionsRef.current.forEach(pc => pc.close());
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

  if (loading) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center text-white font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Room Dashboard...</div>;

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      {/* Main Content: Video Stage */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-gray-800 bg-[#0a0a0a] px-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                 <img src="/realtime-logo.svg" alt="Logo" className="w-5 h-5 invert" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight">{groupName}</h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Live Collaboration Hub</p>
              </div>
           </div>

           <div className="flex items-center gap-2">
              <button 
                onClick={() => setMicOn(!micOn)}
                className={`p-2.5 rounded-xl transition-all ${micOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 text-white'}`}
                title={micOn ? "Mute Mic" : "Unmute Mic"}
              >
                {micOn ? <MicrophoneIcon className="w-5 h-5" /> : <div className="relative"><MicrophoneIcon className="w-5 h-5" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-[1.5px] bg-white rotate-45" /></div></div>}
              </button>
              <button 
                onClick={() => setCameraOn(!cameraOn)}
                className={`p-2.5 rounded-xl transition-all ${cameraOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 text-white'}`}
                title={cameraOn ? "Stop Camera" : "Start Camera"}
              >
                {cameraOn ? <VideoCameraIcon className="w-5 h-5" /> : <VideoCameraSlashIcon className="w-5 h-5" />}
              </button>
              <div className="h-6 w-[1px] bg-gray-800 mx-1" />
              <button 
                onClick={() => navigate(`/groups/${roomId}/collab`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <CommandLineIcon className="w-4 h-4" /> Open Workspace
              </button>
              <button 
                onClick={() => navigate('/groups')}
                className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all"
                title="Leave Room"
              >
                <PhoneXMarkIcon className="w-5 h-5" />
              </button>
           </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-[#0a0a0a] to-[#050505]">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <VideoCard title="You (Local)" isMe muted videoRef={localVideoRef} cameraOn={cameraOn} micOn={micOn} user={user} />
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
             <div className="mt-6 p-4 bg-red-600/20 border border-red-600/30 rounded-2xl text-red-400 text-sm font-medium">
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
      <aside 
        className="bg-[#0a0a0a] border-l border-gray-800 flex flex-col min-w-[300px]"
        style={{ width: sidebarWidth }}
      >
        {/* Chat Section */}
        <section className="flex-1 flex flex-col min-h-0 border-b border-gray-800">
           <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                 <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" /> Live Chat
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => {
                const isMe = m.sender?._id === user?.id || m.sender === user?.id;
                return (
                  <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && <span className="text-[10px] font-bold text-blue-400 mb-1">{m.sender?.name || m.sender}</span>}
                    <div className={`px-3 py-2 rounded-xl text-sm max-w-[90%] break-words ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1e1e1e] text-gray-200 rounded-tl-none border border-gray-800'}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
           </div>
           <div className="p-4 bg-[#111] border-t border-gray-800">
              <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2 bg-[#1a1a1a] rounded-xl px-2 py-1.5 border border-gray-800 focus-within:border-blue-500/50 transition-colors">
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-200 placeholder-gray-600"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="submit" className="p-1.5 text-blue-500 hover:text-blue-400">
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </form>
           </div>
        </section>

        {/* Members & Tasks Tabs */}
        <section className="h-1/2 flex flex-col min-h-0">
           <div className="flex border-b border-gray-800">
              <button className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 border-b-2 border-blue-600 bg-[#0f0f0f]">
                Workspace Context
              </button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-8">
              {/* Task Board */}
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
                  <ClipboardDocumentListIcon className="w-4 h-4" /> Task Board
                </h4>
                <div className="flex gap-2 mb-4">
                  <input 
                    className="flex-1 bg-[#1a1a1a] border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50"
                    placeholder="Quick task..."
                    value={taskInput}
                    onChange={e => setTaskInput(e.target.value)}
                  />
                  <button onClick={createTask} className="p-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg transition-all">
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="group flex items-center gap-3 p-3 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-700 transition-all">
                      <button 
                        onClick={() => socketRef.current?.emit('task:toggle', { groupId: roomId, taskId: t.id, completed: !t.completed })}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${t.completed ? 'bg-green-600 border-green-500 text-white' : 'border-gray-700 bg-transparent text-transparent'}`}
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                      </button>
                      <span className={`flex-1 text-xs font-medium ${t.completed ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{t.title}</span>
                      <button onClick={() => socketRef.current?.emit('task:delete', { groupId: roomId, taskId: t.id })} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Members */}
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
                  <UsersIcon className="w-4 h-4" /> Room Members ({members.length})
                </h4>
                <div className="grid gap-2">
                  {members.map(m => (
                    <div key={m._id} className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors group">
                      <div className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center text-gray-500 border border-gray-800 group-hover:border-blue-500/30 transition-all">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-300">{m.user?.name}</span>
                        <span className="text-[9px] text-gray-600 uppercase font-black tracking-tighter">{m.role}</span>
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

function VideoCard({ title, stream, isMe = false, muted = false, videoRef, cameraOn, micOn, user }) {
  const internalVideoRef = useRef(null);
  const ref = videoRef || internalVideoRef;

  useEffect(() => {
    if (stream && ref.current) ref.current.srcObject = stream;
  }, [stream, ref]);

  return (
    <article className="relative group rounded-2xl overflow-hidden aspect-video bg-[#0a0a0a] border border-gray-800 transition-all hover:border-gray-600">
      {cameraOn ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
           <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-900/30 flex items-center justify-center border-2 border-blue-500/20 shadow-2xl">
              <UserIcon className="w-8 h-8 md:w-10 md:h-10 text-blue-400/80" />
           </div>
           <span className="text-xs md:text-sm font-black text-gray-400 tracking-tight uppercase">{user?.name}</span>
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
      
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
         <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{title} {isMe ? '(You)' : ''}</span>
         </div>
         <div className="flex gap-2">
            {!micOn && (
              <div className="p-1.5 bg-red-600/80 backdrop-blur-md rounded-lg">
                <div className="relative"><MicrophoneIcon className="w-3 h-3 text-white" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-[1px] bg-white rotate-45" /></div></div>
              </div>
            )}
            {!cameraOn && (
              <div className="p-1.5 bg-red-600/80 backdrop-blur-md rounded-lg">
                <VideoCameraSlashIcon className="w-3 h-3 text-white" />
              </div>
            )}
         </div>
      </div>
    </article>
  );
}
