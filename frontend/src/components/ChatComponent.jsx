import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { PaperAirplaneIcon, FaceSmileIcon, PaperClipIcon } from '@heroicons/react/24/solid';

export default function ChatComponent({ groupId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/messages`);
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    fetchMessages();

    const onNewMessage = (msg) => {
      if (msg.group === groupId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('message:new', onNewMessage);
    return () => {
      socket.off('message:new', onNewMessage);
    };
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    socket.emit('message:send', { groupId, text });
    setText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#333]">
      <div className="p-3 border-bottom border-[#333] text-xs font-bold uppercase text-gray-400">
        Group Chat
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => {
          const isMe = m.sender._id === user.id || m.sender === user.id;
          return (
            <div key={m._id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                {!isMe && <span className="text-[10px] font-bold text-blue-400">{m.sender.name}</span>}
                <span className="text-[9px] text-gray-500">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] break-words ${
                isMe ? 'bg-[#007acc] text-white rounded-tr-none' : 'bg-[#2d2d2d] text-gray-200 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 bg-[#252526] border-t border-[#333]">
        <div className="flex items-center gap-2 bg-[#3c3c3c] rounded-md px-2 py-1">
          <button type="button" className="text-gray-400 hover:text-white"><FaceSmileIcon className="w-5 h-5" /></button>
          <input 
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-200 py-1"
          />
          <button type="button" className="text-gray-400 hover:text-white"><PaperClipIcon className="w-5 h-5" /></button>
          <button type="submit" className="text-blue-500 hover:text-blue-400"><PaperAirplaneIcon className="w-5 h-5" /></button>
        </div>
      </form>
    </div>
  );
}
