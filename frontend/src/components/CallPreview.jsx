import React from 'react';
import { socket } from '../socket';
// Simple UI to request a call to a user id
export default function CallPreview({ onStart }){
  const [to, setTo] = React.useState('2');
  const [type, setType] = React.useState('audio');
  React.useEffect(()=>{
    socket.on('call:ring', (payload)=> {
      // for demo: show native confirm
      const accept = confirm('Incoming ' + payload.type + ' call from ' + payload.fromUser.name + '. Accept?');
      if(accept){
        // notify accept by sending answer flow handled in InCall
        // we trigger an event the InCall can listen for
        window.dispatchEvent(new CustomEvent('incoming-call', { detail: payload }));
      }
    });
  },[]);
  const start = ()=> {
    socket.emit('call:request', { toUserId: to, type, isAnonymous: false });
    if(onStart) onStart(to, type);
  };
  return (
    <div style={{border:'1px solid #ddd',padding:10,marginBottom:10}}>
      <h3>Call Preview / Request</h3>
      <div>
        <label>To User ID: <input value={to} onChange={e=>setTo(e.target.value)} /></label>
      </div>
      <div>
        <label>Type:
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value='audio'>Audio</option>
            <option value='video'>Video</option>
          </select>
        </label>
      </div>
      <button onClick={start}>Start Call</button>
    </div>
  );
}
