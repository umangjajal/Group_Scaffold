import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

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

  const axiosAuth = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  useEffect(() => {
    bootstrapRoom();

    return () => {
      leaveMeeting();
      if (socketRef.current) {
        socketRef.current.emit('rtc:leave-room', { roomId });
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
      setMessages((prev) => [
        ...prev,
        {
          id: message._id,
          text: message.text,
          sender: message.sender?.name || 'Unknown',
          timestamp: new Date(message.createdAt),
        },
      ]);
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
    return <div className="call-page" style={{ display: 'grid', placeItems: 'center' }}>Loading room...</div>;
  }

  if (!isMember) {
    return <div className="call-page" style={{ display: 'grid', placeItems: 'center' }}>Access denied.</div>;
  }

  return (
    <div className="room-workspace-page">
      <section className="room-workspace-main">
        <header className="room-header">
          <div>
            <h1 className="room-header__title">Room {roomId}</h1>
            <p className="room-header__subtitle">Realtime meeting, chat, tasks, and collaboration context.</p>
          </div>

          <div className="call-control-bar" role="toolbar" aria-label="Meeting controls">
            <button
              className={`call-control-btn ${cameraOn ? 'is-on' : 'is-off'}`}
              onClick={() => setCameraOn((v) => !v)}
              aria-pressed={cameraOn}
            >
              {cameraOn ? 'Camera On' : 'Camera Off'}
            </button>
            <button
              className={`call-control-btn ${micOn ? 'is-on' : 'is-off'}`}
              onClick={() => setMicOn((v) => !v)}
              aria-pressed={micOn}
            >
              {micOn ? 'Mic On' : 'Mic Off'}
            </button>
            <button className="call-control-btn is-neutral" onClick={() => navigate(`/groups/${roomId}/collab`)}>
              Open Workspace
            </button>
            <button className="call-control-btn is-danger" onClick={() => navigate('/groups')}>
              Leave Room
            </button>
          </div>
        </header>

        {mediaError && <div className="call-error">{mediaError}</div>}

        <div className="workspace-video-grid">
          <VideoCard title="You" muted videoRef={localVideoRef} />
          {remoteStreams.map((peer) => (
            <VideoCard key={peer.peerId} title={peer.name || peer.peerId} stream={peer.stream} />
          ))}
        </div>

        <section className="workspace-card">
          <h2 className="workspace-card__title">Participants ({participants.length + 1})</h2>
          <div className="workspace-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <span className="pill pill--active">{user?.name || 'You'} (You)</span>
            {participants.map((peer) => (
              <span key={peer.id} className="pill">{peer.name}</span>
            ))}
          </div>
        </section>
      </section>

      <aside className="workspace-sidebar">
        <Panel title="Live Chat">
          <div className="workspace-list" style={{ marginBottom: '0.6rem' }}>
            {messages.map((message) => (
              <article key={message.id} className="workspace-list__item">
                <strong>{message.sender}</strong>
                <div>{message.text}</div>
              </article>
            ))}
          </div>
          <div className="workspace-row">
            <input
              className="input-control"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type message"
            />
            <button className="btn btn--secondary" onClick={sendMessage}>Send</button>
          </div>
        </Panel>

        <Panel title="Task Board">
          <div className="workspace-row" style={{ marginBottom: '0.6rem' }}>
            <input
              className="input-control"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="New task"
            />
            <button className="btn btn--primary" onClick={createTask}>Add</button>
          </div>
          <div className="workspace-list">
            {tasks.map((task) => (
              <article key={task.id} className="workspace-list__item" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.4rem', alignItems: 'center' }}>
                <button
                  className="btn btn--ghost"
                  style={{ justifyContent: 'flex-start', paddingInline: '0.45rem' }}
                  onClick={() =>
                    socketRef.current?.emit('task:toggle', {
                      groupId: roomId,
                      taskId: task.id,
                      completed: !task.completed,
                    })
                  }
                >
                  <span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</span>
                </button>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>v{task.version || 1}</span>
                <button
                  className="btn btn--danger"
                  style={{ minWidth: '2.2rem', paddingInline: '0.45rem' }}
                  onClick={() => socketRef.current?.emit('task:delete', { groupId: roomId, taskId: task.id })}
                >
                  x
                </button>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title={`Members (${members.length})`}>
          <div className="workspace-list">
            {members.map((member) => (
              <div key={member._id} className="workspace-list__item">
                <strong>{member.user?.name}</strong>
                <div style={{ color: '#94a3b8' }}>{member.role}</div>
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
    <section className="workspace-card">
      <h3 className="workspace-card__title">{title}</h3>
      <div className="workspace-card__body">{children}</div>
    </section>
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
    <article className="video-tile">
      <video ref={ref} autoPlay playsInline muted={muted} className="video-tile__media" />
      <div className="video-tile__label">{title}</div>
    </article>
  );
}
