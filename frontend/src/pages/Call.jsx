import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const WS_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:4000';

export default function Call() {
  const { sessionId } = useParams();
  const { accessToken } = useAuth();
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

  const iceServers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  useEffect(() => {
    const endCall = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      pendingCandidatesRef.current = [];
      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current?.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
      setCallActive(false);
    };

    const startPeerConnection = async (isCaller, remoteUserId) => {
      peerConnectionRef.current = new RTCPeerConnection(iceServers);

      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = localStream;
      localStream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, localStream);
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
    const stream = localVideoRef.current?.srcObject;
    if (!stream) return;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [cameraOn, micOn]);

  const handleEndCallClick = () => {
    if (socketRef.current) {
      socketRef.current.emit('call:end', { sessionId });
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    navigate('/groups');
  };

  return (
    <div className="call-page">
      <div className="call-layout">
        <header className="call-header">
          <div>
            <h1 className="call-title">Call Session {sessionId}</h1>
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
