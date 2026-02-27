import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const WS_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:4000';

export default function Call() {
  const { sessionId } = useParams();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const pendingCandidatesRef = useRef([]); // RTC candidates waiting for remote SDP

  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  const iceServers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  useEffect(() => {
    async function initLocalStream() {
      // Check for Secure Context (WebRTC requires HTTPS or localhost)
      if (!window.isSecureContext) {
        setError("Your browser requires a secure connection (HTTPS or localhost) for camera access. It will not work on an unsafe connection.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("Could not access camera/microphone. Ensure permissions are granted and you're on a secure (HTTPS) connection.");
      }
    }
    initLocalStream();
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current && !localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const { data } = await api.get(`/groups/${sessionId}`);
        setGroupName(data.name);
      } catch (err) {
        console.error('Error fetching group:', err);
        setGroupName(`Room ${sessionId}`);
      }
    };
    if (sessionId) fetchGroup();
  }, [sessionId]);

  useEffect(() => {
    const endCall = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      pendingCandidatesRef.current = [];
      // Don't stop local stream here if we want it to persist, or stop it if we want to reset
      if (remoteVideoRef.current?.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
      setCallActive(false);
    };

    const startPeerConnection = async (isCaller, remoteUserId) => {
      peerConnectionRef.current = new RTCPeerConnection(iceServers);

      // Use the existing localStream from ref
      let currentStream = localStreamRef.current;
      if (!currentStream) {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(currentStream);
        localStreamRef.current = currentStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }
      }

      currentStream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, currentStream);
      });

      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('call:candidate', {
            to: remoteUserId,
            candidate: event.candidate,
            sessionId,
          });
        }
      };

      if (isCaller) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('call:offer', {
          to: remoteUserId,
          sdp: peerConnectionRef.current.localDescription,
          sessionId,
        });
      }

      setCallActive(true);
    };

    socketRef.current = io(WS_URL, {
      auth: { token: accessToken },
    });

    socketRef.current.on('call:ring', async ({ fromUser }) => {
        // Automatically start the connection (for testing/simple use)
        // In a real app, you would wait for the user to click "Accept"
    });

    socketRef.current.on('call:active', async ({ participants }) => {
        const otherParticipant = participants.find(id => id !== user?.id);
        if (!peerConnectionRef.current) {
            await startPeerConnection(true, otherParticipant);
        }
    });

    socketRef.current.on('call:offer', async ({ from, sdp }) => {
      if (!peerConnectionRef.current) {
        await startPeerConnection(false, from);
      }

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      
      // Drain candidates
      for (const candidate of pendingCandidatesRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socketRef.current.emit('call:answer', {
        to: from,
        sdp: peerConnectionRef.current.localDescription,
        sessionId,
      });
    });

    socketRef.current.on('call:answer', async ({ from, sdp }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        // Drain candidates
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
      }
    });

    socketRef.current.on('call:candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding candidate', e);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    });

    socketRef.current.on('call:ended', () => {
      endCall();
      navigate('/groups');
    });

    return () => {
      endCall();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionId, accessToken, navigate, user?.id]);

  useEffect(() => {
    if (!localStream) return;

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [cameraOn, micOn, localStream]);

  const handleEndCallClick = () => {
    if (socketRef.current) {
      socketRef.current.emit('call:end', { sessionId });
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    navigate('/groups');
  };

  return (
    <div className="call-page">
      <div className="call-layout">
        <header className="call-header">
          <div>
            <h1 className="call-title">{groupName || 'Call Session'}</h1>
            <p className="call-subtitle">Secure realtime call session for your room.</p>
          </div>
        </header>

        {error && <div className="call-error">{error}</div>}

        <section className="call-stage">
          <article className="call-video">
            <video ref={localVideoRef} autoPlay muted playsInline />
            <div className="call-video__label">Your stream</div>
          </article>
          <article className="call-video">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <div className="call-video__label">Remote stream</div>
          </article>
        </section>

        <div className="call-control-bar" role="toolbar" aria-label="Call controls">
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
          <button className="call-control-btn is-danger" onClick={handleEndCallClick}>
            Leave Call
          </button>
        </div>

        <p className="call-status">{callActive ? 'Connected' : 'Connecting...'}</p>
      </div>
    </div>
  );
}
