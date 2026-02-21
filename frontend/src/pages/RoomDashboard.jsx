import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function RoomDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());

  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState([]);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mediaError, setMediaError] = useState('');

  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');

  const token = localStorage.getItem('accessToken');

  const axiosAuth = useMemo(() => (
    axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${token}` },
    })
  ), [token]);

  useEffect(() => {
    bootstrapRoom();

    return () => {
      leaveMeeting();
      if (socketRef.current) {
        socketRef.current.emit('leave', { groupId: roomId });
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [cameraOn, micOn]);

  async function bootstrapRoom() {
    try {
      setLoading(true);
      const res = await axiosAuth.get(`/api/groups/${roomId}/members`);
      const groupMembers = Array.isArray(res.data) ? res.data : [];
      const isUserMember = groupMembers.some((m) => m.user?._id === user?.id || m.user?._id === user?._id);

      if (!isUserMember) {
        await axiosAuth.post(`/api/groups/${roomId}/join`);
      }

      setIsMember(true);
      setMembers(groupMembers);
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
    } catch (error) {
      setMediaError(`Camera/Mic unavailable: ${error.message}`);
    }
  }

  function initializeSocket() {
    const userToken = localStorage.getItem('accessToken');

    const socket = io(API_URL, {
      auth: { token: userToken },
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { groupId: roomId });
      socket.emit('meeting:join', { groupId: roomId });
      socket.emit('task:list', { groupId: roomId });
    });

    socket.on('message:new', (message) => {
      setMessages((prev) => [...prev, {
        id: message._id,
        text: message.text,
        sender: message.sender?.name || 'Unknown',
        timestamp: new Date(message.createdAt),
      }]);
    });

    socket.on('meeting:participants', ({ participants: existingPeers }) => {
      setParticipants(existingPeers || []);
      (existingPeers || []).forEach((peer) => createPeerConnection(peer.id, peer.name, true));
    });

    socket.on('meeting:peer-joined', ({ peer }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.id === peer.id)) return prev;
        return [...prev, peer];
      });
      createPeerConnection(peer.id, peer.name, false);
    });

    socket.on('meeting:signal', ({ from, signal }) => {
      handleMeetingSignal(from, signal);
    });

    socket.on('meeting:peer-left', ({ peerId }) => {
      removePeer(peerId);
      setParticipants((prev) => prev.filter((peer) => peer.id !== peerId));
    });

    socket.on('task:list', ({ tasks: incomingTasks }) => {
      setTasks(Array.isArray(incomingTasks) ? incomingTasks : []);
    });

    socket.on('task:upsert', ({ task }) => {
      if (!task) return;
      setTasks((prev) => {
        const exists = prev.some((item) => item.id === task.id);
        if (!exists) return [task, ...prev];
        return prev.map((item) => (item.id === task.id ? task : item));
      });
    });

    socket.on('task:delete', ({ taskId }) => {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    });
  }

  function getIceServers() {
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (import.meta.env.VITE_TURN_URL && import.meta.env.VITE_TURN_USER && import.meta.env.VITE_TURN_PASS) {
      servers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USER,
        credential: import.meta.env.VITE_TURN_PASS,
      });
    }
    return servers;
  }

  async function createPeerConnection(peerId, peerName, initiator) {
    if (!peerId || peerConnectionsRef.current.has(peerId)) return;

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams((prev) => {
        const existing = prev.find((item) => item.peerId === peerId);
        if (existing) {
          return prev.map((item) => (item.peerId === peerId ? { ...item, stream, name: peerName || item.name } : item));
        }
        return [...prev, { peerId, name: peerName || 'Participant', stream }];
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) return;
      socketRef.current.emit('meeting:signal', {
        groupId: roomId,
        to: peerId,
        signal: { candidate: event.candidate },
      });
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        removePeer(peerId);
      }
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
    try {
      if (!peerConnectionsRef.current.has(from)) {
        const peer = participants.find((participant) => participant.id === from);
        await createPeerConnection(from, peer?.name, false);
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

      if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error('Signal handling error:', error);
    }
  }

  function removePeer(peerId) {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setRemoteStreams((prev) => prev.filter((item) => item.peerId !== peerId));
  }

  function leaveMeeting() {
    socketRef.current?.emit('meeting:leave', { groupId: roomId });
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams([]);
    setParticipants([]);
  }

  function sendMessage() {
    const text = messageInput.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('message:send', { groupId: roomId, text, mediaUrl: null });
    setMessageInput('');
  }

  function createTask() {
    const title = taskInput.trim();
    if (!title || !socketRef.current) return;
    socketRef.current.emit('task:create', { groupId: roomId, title });
    setTaskInput('');
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-slate-900">Loading room...</div>;
  }

  if (!isMember) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-slate-900">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 grid grid-cols-1 xl:grid-cols-4 gap-4">
      <section className="xl:col-span-3 space-y-4">
        <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Meeting Room: {roomId}</h1>
          <div className="flex gap-2">
            <button className={`px-3 py-2 rounded ${cameraOn ? 'bg-emerald-600' : 'bg-slate-700'}`} onClick={() => setCameraOn((v) => !v)}>Camera</button>
            <button className={`px-3 py-2 rounded ${micOn ? 'bg-emerald-600' : 'bg-slate-700'}`} onClick={() => setMicOn((v) => !v)}>Mic</button>
            <button className="px-3 py-2 rounded bg-indigo-600" onClick={() => navigate(`/groups/${roomId}/collab`)}>Collab</button>
            <button className="px-3 py-2 rounded bg-rose-600" onClick={() => navigate('/groups')}>Leave</button>
          </div>
        </div>

        {mediaError && <div className="bg-rose-900/60 border border-rose-600 rounded p-2 text-sm">{mediaError}</div>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <VideoCard title="You" muted videoRef={localVideoRef} />
          {remoteStreams.map((peer) => (
            <VideoCard key={peer.peerId} title={peer.name || peer.peerId} stream={peer.stream} />
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Participants ({participants.length + 1})</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-slate-700">{user?.name || 'You'} (You)</span>
            {participants.map((peer) => (
              <span key={peer.id} className="px-2 py-1 rounded bg-slate-700">{peer.name}</span>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <Panel title="Live Chat">
          <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
            {messages.map((message) => (
              <div key={message.id} className="bg-slate-700 rounded p-2 text-sm">
                <p className="font-medium">{message.sender}</p>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-700 rounded px-2 py-1 text-sm" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Type message" />
            <button className="bg-blue-600 px-3 rounded" onClick={sendMessage}>Send</button>
          </div>
        </Panel>

        <Panel title="Task Board">
          <div className="flex gap-2 mb-2">
            <input className="flex-1 bg-slate-700 rounded px-2 py-1 text-sm" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="New task" />
            <button className="bg-emerald-600 px-3 rounded" onClick={createTask}>Add</button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {tasks.map((task) => (
              <div key={task.id} className="bg-slate-700 rounded p-2 flex items-center justify-between gap-2 text-sm">
                <button className={`text-left flex-1 ${task.completed ? 'line-through text-slate-400' : ''}`} onClick={() => socketRef.current?.emit('task:toggle', { groupId: roomId, taskId: task.id, completed: !task.completed })}>{task.title}</button>
                <span className="text-xs text-slate-400">v{task.version || 1}</span>
                <button className="text-rose-300" onClick={() => socketRef.current?.emit('task:delete', { groupId: roomId, taskId: task.id })}>✕</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`Members (${members.length})`}>
          <div className="space-y-1 text-sm">
            {members.map((member) => (
              <div key={member._id} className="bg-slate-700 rounded px-2 py-1">
                {member.user?.name} • {member.role}
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function VideoCard({ title, stream, muted = false, videoRef }) {
  const internalVideoRef = useRef(null);
  const ref = videoRef || internalVideoRef;

  useEffect(() => {
    if (stream && ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream, ref]);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <video ref={ref} autoPlay playsInline muted={muted} className="w-full aspect-video bg-black object-cover" />
      <div className="px-3 py-2 text-sm">{title}</div>
    </div>
  );
}
