import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:4000';

export default function Chat() {
  const { groupId } = useParams();
  const { accessToken, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/groups/${groupId}/messages`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        setMessages(res.data.messages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    fetchMessages();
  }, [groupId, accessToken]);

  useEffect(() => {
    // Connect socket
    socketRef.current = io(WS_URL, {
      auth: { token: accessToken }
    });

    socketRef.current.emit('join', { groupId });

    socketRef.current.on('message:new', (msg) => {
      if (msg.group === groupId) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      socketRef.current.emit('leave', { groupId });
      socketRef.current.disconnect();
    };
  }, [groupId, accessToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socketRef.current.emit('message:send', { groupId, text });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2>Group Chat</h2>
      <div
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          marginBottom: '10px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px'
        }}
      >
        {messages.map(m => (
          <div
            key={m._id}
            style={{
              marginBottom: '10px',
              textAlign: m.sender._id === user.id ? 'right' : 'left'
            }}
          >
            <div
              style={{
                display: 'inline-block',
                backgroundColor: m.sender._id === user.id ? '#DCF8C6' : '#FFF',
                padding: '8px 12px',
                borderRadius: '15px',
                maxWidth: '80%',
                wordWrap: 'break-word',
                boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px' }}>
                {m.sender.name}
              </div>
              {m.text && <div>{m.text}</div>}
              {m.mediaUrl && (
                <div>
                  <img src={m.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '5px' }} />
                </div>
              )}
              <div style={{ fontSize: '0.7em', color: '#999', marginTop: '4px' }}>
                {new Date(m.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <textarea
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        style={{ width: '100%', padding: '8px', borderRadius: '4px', resize: 'none' }}
      />
      <button onClick={sendMessage} style={{ marginTop: '8px', padding: '10px 20px' }}>
        Send
      </button>
    </div>
  );
}