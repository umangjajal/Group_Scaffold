import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { 
  VideoCameraIcon, 
  VideoCameraSlashIcon, 
  MicrophoneIcon, 
  SpeakerWaveIcon,
  PhoneXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  UserIcon,
  BookmarkIcon,
  BookmarkSlashIcon
} from '@heroicons/react/24/solid';

const WS_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:4000';

export default function Call() {
  const { sessionId } = useParams();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteCameraOn, setRemoteCameraOn] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [pinnedUser, setPinnedUser] = useState(null); // 'local' or 'remote'
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);

  const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  useEffect(() => {
    async function initLocalStream() {
      if (!window.isSecureContext) {
        setError("Secure connection (HTTPS/localhost) required for camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        setError("Could not access camera/microphone.");
      }
    }
    initLocalStream();
  }, []);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const { data } = await api.get(`/groups/${sessionId}`);
        setGroupName(data.name);
      } catch (err) { setGroupName(`Room ${sessionId}`); }
    };
    if (sessionId) fetchGroup();
  }, [sessionId]);

  useEffect(() => {
    socketRef.current = io(WS_URL, { auth: { token: accessToken } });

    const startPeerConnection = async (isCaller, remoteUserId) => {
      peerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      const stream = localStream || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!localStream) setLocalStream(stream);
      
      stream.getTracks().forEach(t => peerConnectionRef.current.addTrack(t, stream));
      
      peerConnectionRef.current.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      peerConnectionRef.current.onicecandidate = (e) => {
        if (e.candidate) socketRef.current.emit('call:candidate', { to: remoteUserId, candidate: e.candidate, sessionId });
      };

      if (isCaller) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('call:offer', { to: remoteUserId, sdp: peerConnectionRef.current.localDescription, sessionId });
      }
      setCallActive(true);
    };

    socketRef.current.on('call:active', async ({ participants }) => {
        const sorted = [...participants].sort();
        const other = participants.find(id => id !== user?.id);
        if (!peerConnectionRef.current && other) {
            await startPeerConnection(sorted[0] === user?.id, other);
            // Fetch other user info
            try {
              const { data } = await api.get(`/users/${other}`);
              setRemoteUser(data);
            } catch(e) {}
        }
    });

    socketRef.current.on('call:offer', async ({ from, sdp }) => {
      if (!peerConnectionRef.current) await startPeerConnection(false, from);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingCandidatesRef.current) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current = [];
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socketRef.current.emit('call:answer', { to: from, sdp: peerConnectionRef.current.localDescription, sessionId });
    });

    socketRef.current.on('call:answer', async ({ sdp }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        for (const c of pendingCandidatesRef.current) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
        pendingCandidatesRef.current = [];
      }
    });

    socketRef.current.on('call:candidate', async ({ candidate }) => {
      if (peerConnectionRef.current?.remoteDescription) {
        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
      } else pendingCandidatesRef.current.push(candidate);
    });

    socketRef.current.on('call:track-state', ({ userId, type, enabled }) => {
        if (userId !== user.id && type === 'video') setRemoteCameraOn(enabled);
    });

    socketRef.current.on('call:ended', () => {
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      navigate('/groups');
    });

    return () => {
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      socketRef.current.disconnect();
    };
  }, [sessionId, accessToken, user?.id, localStream, navigate]);

  useEffect(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => t.enabled = cameraOn);
    localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    socketRef.current?.emit('call:track-state', { sessionId, type: 'video', enabled: cameraOn });
  }, [cameraOn, micOn, localStream, sessionId]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen bg-[#050505] text-white overflow-hidden transition-all ${isFullScreen ? 'p-0' : 'p-4'}`}>
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold">R</div>
          <div>
            <h1 className="text-lg font-bold leading-none">{groupName}</h1>
            <p className="text-xs text-gray-500 mt-1">Live Meeting • {callActive ? 'Connected' : 'Connecting...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={toggleFullScreen} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
              {isFullScreen ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
            </button>
        </div>
      </header>

      {/* Main Stage */}
      <div className="flex-1 relative flex gap-4 min-h-0">
        <div className={`relative transition-all duration-500 flex-1 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] ${pinnedUser === 'local' ? 'flex-none w-1/4' : ''}`}>
           {/* Remote Video (Default Main) */}
           <div className="w-full h-full relative">
              {remoteCameraOn ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
                  <div className="w-24 h-24 rounded-full bg-blue-900/50 flex items-center justify-center border-2 border-blue-500/30">
                    <UserIcon className="w-12 h-12 text-blue-400" />
                  </div>
                  <span className="text-xl font-medium text-gray-300">{remoteUser?.name || 'Remote Participant'}</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-xs font-medium flex items-center gap-2">
                <SpeakerWaveIcon className="w-3 h-3 text-green-400" /> {remoteUser?.name || 'Participant'}
              </div>
              <button onClick={() => setPinnedUser(pinnedUser === 'remote' ? null : 'remote')} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full">
                {pinnedUser === 'remote' ? <BookmarkSlashIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
              </button>
           </div>
        </div>

        {/* Local Preview / Grid Side */}
        <div className={`relative transition-all duration-500 rounded-2xl overflow-hidden border border-gray-800 bg-[#111] ${pinnedUser === 'remote' || !pinnedUser ? 'w-1/4' : 'flex-1'}`}>
           <div className="w-full h-full relative">
              {cameraOn ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#1a1a1a]">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-400">You (Camera Off)</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-xs font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> You
              </div>
              <button onClick={() => setPinnedUser(pinnedUser === 'local' ? null : 'local')} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full">
                {pinnedUser === 'local' ? <BookmarkSlashIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
              </button>
           </div>
        </div>
      </div>

      {/* Control Bar */}
      <footer className="h-24 flex items-center justify-center">
        <div className="flex items-center gap-4 px-6 py-3 bg-[#111] border border-gray-800 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={() => setMicOn(!micOn)}
              className={`p-3 rounded-xl transition-all ${micOn ? 'bg-gray-800 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {micOn ? <MicrophoneIcon className="w-6 h-6" /> : <div className="relative"><MicrophoneIcon className="w-6 h-6" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-[2px] bg-white rotate-45" /></div></div>}
            </button>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Mute</span>
          </div>

          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={() => setCameraOn(!cameraOn)}
              className={`p-3 rounded-xl transition-all ${cameraOn ? 'bg-gray-800 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {cameraOn ? <VideoCameraIcon className="w-6 h-6" /> : <VideoCameraSlashIcon className="w-6 h-6" />}
            </button>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Camera</span>
          </div>

          <div className="w-[1px] h-8 bg-gray-800 mx-2" />

          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={() => { socketRef.current?.emit('call:end', { sessionId }); navigate('/groups'); }}
              className="p-3 bg-red-600 hover:bg-red-700 rounded-xl transition-all"
            >
              <PhoneXMarkIcon className="w-6 h-6" />
            </button>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">End</span>
          </div>
        </div>
      </footer>

      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-600/90 backdrop-blur-md text-white text-sm rounded-lg shadow-xl border border-red-500/50">
          {error}
        </div>
      )}
    </div>
  );
}
