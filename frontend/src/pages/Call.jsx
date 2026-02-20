import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState('');

  // STUN servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // Production apps should have a TURN server here for reliability
    ],
  };

  useEffect(() => {
    // --- Define call functions inside useEffect to capture correct state ---

    const endCall = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        remoteVideoRef.current.srcObject = null;
      }
      setCallActive(false);
    };

    const startPeerConnection = async (isCaller) => {
      peerConnectionRef.current = new RTCPeerConnection(iceServers);

      // Get local media stream
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = localStream;

      // Add tracks to peer connection
      localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStream);
      });

      // When remote stream arrives, display it
      peerConnectionRef.current.ontrack = event => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Send ICE candidates to the other peer
      peerConnectionRef.current.onicecandidate = event => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('call:signal', { to: null, data: { candidate: event.candidate } });
        }
      };

      if (isCaller) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('call:signal', { to: null, data: { sdp: peerConnectionRef.current.localDescription } });
      }

      setCallActive(true);
    };

    // --- Main effect logic ---

    socketRef.current = io(WS_URL, {
      auth: { token: accessToken },
    });

    socketRef.current.emit('call:join', { sessionId });

    socketRef.current.on('call:signal', async ({ from, data }) => {
      if (!peerConnectionRef.current) {
        await startPeerConnection(false);
      }
      if (data.sdp) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socketRef.current.emit('call:signal', { to: from, data: { sdp: peerConnectionRef.current.localDescription } });
        }
      } else if (data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding received ICE candidate', e);
        }
      }
    });

    socketRef.current.on('call:end', () => {
      endCall();
      alert('Call ended by the other user.');
      navigate('/groups');
    });

    startPeerConnection(true).catch(err => {
      setError('Failed to start call: ' + err.message);
      console.error(err);
    });

    return () => {
      endCall();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionId, accessToken, navigate]); // Added navigate to dependency array

  const handleEndCallClick = () => {
    if (socketRef.current) {
      socketRef.current.emit('call:end', { sessionId });
    }
    // `endCall` is not directly accessible here, but the effect cleanup will handle it.
    // We can just navigate away.
    if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    navigate('/groups');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
      <h2>Call Session: {sessionId}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>Your Video</h3>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 320, height: 240, backgroundColor: '#000' }} />
        </div>
        <div>
          <h3>Remote Video</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 320, height: 240, backgroundColor: '#000' }} />
        </div>
      </div>
      {callActive ? (
        <button
          onClick={handleEndCallClick}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#e53e3e',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          End Call
        </button>
      ) : (
        <p>Connecting...</p>
      )}
    </div>
  );
}