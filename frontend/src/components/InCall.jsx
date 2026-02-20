import React from 'react';
import { socket } from '../socket';
// Very simple WebRTC peer connection example using Socket.IO for signaling.
export default function InCall({ peerId, type='audio', onEnd }){
  const localRef = React.useRef();
  const remoteRef = React.useRef();
  const pcRef = React.useRef();
  React.useEffect(()=>{
    // create PeerConnection with optional TURN config from env
    const turnUrl = (import.meta.env.VITE_TURN_URL) ? [{ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS }] : [];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...turnUrl] });
    pcRef.current = pc;
    pc.ontrack = (e)=> { if(remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e)=> { if(e.candidate) socket.emit('call:candidate', { to: peerId, candidate: e.candidate }); };
    // handle remote signals
    socket.on('call:offer', async ({ from, sdp })=> {
      if(from !== peerId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const ms = await navigator.mediaDevices.getUserMedia(type==='video' ? { video:true, audio:true } : { audio:true });
      ms.getTracks().forEach(t=> pc.addTrack(t, ms));
      if(localRef.current) localRef.current.srcObject = ms;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: from, sdp: pc.localDescription });
    });
    socket.on('call:answer', async ({ from, sdp })=> {
      if(from !== peerId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });
    socket.on('call:candidate', async ({ from, candidate })=> {
      if(from !== peerId) return;
      try{ await pc.addIceCandidate(candidate); }catch(e){ console.warn(e); }
    });
    // initiate call: create offer
    (async ()=>{
      try{
        const ms = await navigator.mediaDevices.getUserMedia(type==='video' ? { video:true, audio:true } : { audio:true });
        ms.getTracks().forEach(t=> pc.addTrack(t, ms));
        if(localRef.current) localRef.current.srcObject = ms;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { to: peerId, sdp: pc.localDescription });
      }catch(e){ console.error('media error', e); alert('Could not get microphone/camera: '+e.message); onEnd(); }
    })();
    return ()=> {
      try{ pc.getSenders().forEach(s=> s.track && s.track.stop()); }catch(e){}
      pc.close();
      socket.off('call:offer'); socket.off('call:answer'); socket.off('call:candidate');
    };
  },[peerId]);
  return (
    <div style={{border:'1px solid #bbb',padding:10}}>
      <h3>In Call with {peerId} ({type})</h3>
      <div style={{display:'flex',gap:10}}>
        <div>
          <div>Local</div>
          <video ref={localRef} autoPlay muted style={{width:200,background:'#000'}}/>
        </div>
        <div>
          <div>Remote</div>
          <video ref={remoteRef} autoPlay style={{width:400,background:'#000'}}/>
        </div>
      </div>
      <div style={{marginTop:10}}>
        <button onClick={()=>{ socket.emit('call:end', { sessionId: 'demo', reason:'user_end' }); onEnd(); }}>End Call</button>
      </div>
    </div>
  );
}
