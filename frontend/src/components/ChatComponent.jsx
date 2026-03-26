import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { buildBackendUrl } from '../network/config';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import EmojiPicker from 'emoji-picker-react';

export default function ChatComponent({ groupId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    if (!groupId) return undefined;

    socket.emit('join', { groupId });

    return () => {
      socket.emit('leave', { groupId });
    };
  }, [groupId]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/messages`);
        setMessages(data.messages || []);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    fetchMessages();

    const onNewMessage = (msg) => {
      const messageGroupId = msg.group?._id || msg.group;
      if (String(messageGroupId) === String(groupId)) {
        setMessages((prev) => [...prev, msg]);
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

  // Handle clicking outside emoji picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    socket.emit('message:send', { groupId, text });
    setText('');
    setShowEmoji(false);
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Send message with file URL
      const fileText = `File: ${file.name}`;
      socket.emit('message:send', {
        groupId,
        text: fileText,
        mediaUrl: data.url,
      });
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#333] relative">
      <div className="p-3 border-b border-[#333] text-[10px] font-bold uppercase text-gray-400 flex justify-between items-center">
        <span>Group Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => {
          const senderId = m.sender?._id || m.sender?.id || m.sender;
          const currentUserId = user?.id || user?._id;
          const isMe = String(senderId) === String(currentUserId);
          return (
            <div key={m._id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                {!isMe && (
                  <span className="text-[10px] font-bold text-blue-400">
                    {m.sender?.name || 'User'}
                  </span>
                )}
                <span className="text-[9px] text-gray-500">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`px-3 py-2 rounded-lg text-sm max-w-[90%] break-words ${
                  isMe
                    ? 'bg-[#007acc] text-white rounded-tr-none'
                    : 'bg-[#2d2d2d] text-gray-200 rounded-tl-none'
                }`}
              >
                {m.mediaUrl ? (
                  <a
                    href={buildBackendUrl(m.mediaUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 underline decoration-blue-400"
                  >
                    <DocumentIcon className="w-4 h-4" />
                    {m.text || 'View File'}
                  </a>
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {showEmoji && (
        <div className="absolute bottom-16 right-4 z-50" ref={emojiPickerRef}>
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme="dark"
            width={300}
            height={400}
            skinTonesDisabled
            searchDisabled
          />
        </div>
      )}

      <form onSubmit={sendMessage} className="p-3 bg-[#252526] border-t border-[#333]">
        <div className="flex items-center gap-2 bg-[#3c3c3c] rounded-md px-2 py-1 relative">
          <button
            type="button"
            className={`transition-colors ${showEmoji ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setShowEmoji(!showEmoji)}
          >
            <FaceSmileIcon className="w-5 h-5" />
          </button>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={uploading ? 'Uploading...' : 'Type a message...'}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-200 py-1"
            disabled={uploading}
          />

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          <button
            type="button"
            className="text-gray-400 hover:text-white disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <PaperClipIcon className="w-5 h-5" />
          </button>

          <button
            type="submit"
            className="text-blue-500 hover:text-blue-400 disabled:opacity-50"
            disabled={!text.trim() || uploading}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
