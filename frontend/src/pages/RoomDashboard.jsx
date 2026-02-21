import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function VideoTile({ label, stream, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-gray-700 min-h-[180px]">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      <div className="absolute left-2 bottom-2 px-2 py-1 rounded bg-black/70 text-xs">{label}</div>
    </div>
  );
}

export default function RoomDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const socketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState([]);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('accessToken');

  const axiosAuth = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const ensureLocalMedia = async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeerConnection = async (peerId, peerName) => {
    let pc = peerConnectionsRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    const stream = await ensureLocalMedia();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: { name: peerName || prev[peerId]?.name || 'Participant', stream },
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('rtc:candidate', {
          roomId,
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    return pc;
  };

  const sendOffer = async (peer) => {
    const pc = await createPeerConnection(peer.userId, peer.name);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('rtc:offer', {
      roomId,
      to: peer.userId,
      sdp: pc.localDescription,
    });
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const res = await axiosAuth.get(`/api/groups/${roomId}/members`);
        const isUserMember = res.data.some((m) => m.user?._id === user?._id || m.userId === user?._id || m._id === user?._id);

        if (!isUserMember) {
          await axiosAuth.post(`/api/groups/${roomId}/join`);
        }

        if (!mounted) return;
        setMembers(res.data);
        setIsMember(true);

        await ensureLocalMedia();

        const socket = io(API_URL, {
          auth: { token },
          reconnection: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join', { groupId: roomId });
          socket.emit('rtc:join-room', { roomId });
        });

        socket.on('message:new', (message) => {
          setMessages((prev) => [
            ...prev,
            {
              id: message._id,
              text: message.text,
              sender: message.sender.name,
              timestamp: new Date(message.createdAt),
            },
          ]);
        });

        socket.on('rtc:participants', async ({ participants }) => {
          for (const peer of participants) {
            await sendOffer(peer);
          }
        });

        socket.on('rtc:user-joined', ({ participant }) => {
          setRemoteStreams((prev) => ({
            ...prev,
            [participant.userId]: prev[participant.userId] || { name: participant.name, stream: null },
          }));
        });

        socket.on('rtc:user-left', ({ userId }) => {
          const pc = peerConnectionsRef.current.get(userId);
          if (pc) pc.close();
          peerConnectionsRef.current.delete(userId);
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        });

        socket.on('rtc:offer', async ({ from, fromName, sdp }) => {
          const pc = await createPeerConnection(from, fromName);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('rtc:answer', { roomId, to: from, sdp: pc.localDescription });
        });

        socket.on('rtc:answer', async ({ from, sdp }) => {
          const pc = peerConnectionsRef.current.get(from);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        socket.on('rtc:candidate', async ({ from, candidate }) => {
          const pc = await createPeerConnection(from);
          if (!candidate) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (candidateError) {
            console.error('Failed to add ICE candidate', candidateError);
          }
        });

        socket.on('error', (socketError) => {
          setError(socketError?.message || 'Socket error occurred');
        });
      } catch (bootError) {
        console.error(bootError);
        setError('Unable to join room or access camera/microphone.');
        navigate('/groups');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    boot();

    return () => {
      mounted = false;

      if (socketRef.current) {
        socketRef.current.emit('rtc:leave-room', { roomId });
        socketRef.current.emit('leave', { groupId: roomId });
        socketRef.current.disconnect();
      }

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [axiosAuth, roomId, token, user?._id, navigate]);

  const sendMessage = () => {
    if (!messageInput.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { groupId: roomId, text: messageInput.trim(), mediaUrl: null });
    setMessageInput('');
  };

  const toggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading room...</div>;
  }

  if (!isMember) {
    return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Room access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3 space-y-4">
        {error && <div className="bg-red-500/20 border border-red-500 text-red-200 rounded p-2 text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <VideoTile label={`${user?.name || 'You'} (You)`} stream={localStream} muted />
          {Object.entries(remoteStreams).map(([id, peer]) => (
            <VideoTile key={id} label={peer.name || 'Participant'} stream={peer.stream} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleCamera} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700">
            {isCameraOn ? 'Camera On' : 'Camera Off'}
          </button>
          <button onClick={toggleMic} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700">
            {isMicOn ? 'Mic On' : 'Mic Off'}
          </button>
          <button onClick={() => navigate('/groups')} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700">
            Leave Room
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-800 font-semibold">Chat</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-gray-800 rounded p-2 text-sm">
              <div className="text-blue-300 text-xs">{msg.sender}</div>
              <div>{msg.text}</div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm"
            placeholder="Type a message"
          />
          <button onClick={sendMessage} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">
            Send
          </button>
        </div>

        <div className="px-3 py-2 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Members ({members.length})</div>
          <div className="text-xs text-gray-300 max-h-24 overflow-y-auto">
            {members.map((member) => (
              <div key={member._id}>{member.user?.name || 'Member'}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
