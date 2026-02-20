import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function RoomDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [showChat, setShowChat] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: isMicOn })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.error('Error accessing camera:', err));
    }
  }, [isCameraOn, isMicOn]);

  useEffect(() => {
    checkMembershipAndFetchData();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave', { groupId: roomId });
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  const checkMembershipAndFetchData = async () => {
    try {
      setLoading(true);
      // Check if user is a member
      const res = await axiosAuth.get(`/api/groups/${roomId}/members`);
      const isUserMember = res.data.some(m => m._id === user._id || m.userId === user._id);
      
      if (!isUserMember) {
        // User is not a member, try to join
        try {
          await axiosAuth.post(`/api/groups/${roomId}/join`);
          setIsMember(true);
        } catch (err) {
          // Can't join, redirect back
          navigate('/groups');
          return;
        }
      } else {
        setIsMember(true);
      }
      
      setMembers(res.data);
      
      // Initialize Socket.io connection
      initializeSocket();
    } catch (err) {
      console.error('Error checking membership:', err);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const initializeSocket = () => {
    try {
      const userToken = localStorage.getItem('accessToken');
      
      socketRef.current = io(API_URL, {
        auth: {
          token: userToken,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Join group chat room
      socketRef.current.emit('join', { groupId: roomId });

      // Listen for new messages
      socketRef.current.on('message:new', (message) => {
        setMessages(prev => [...prev, {
          id: message._id,
          text: message.text,
          sender: message.sender.name,
          senderImage: message.sender.avatarUrl,
          timestamp: new Date(message.createdAt)
        }]);
      });

      // Listen for typing indicators
      socketRef.current.on('typing', (data) => {
        console.log(`${data.userId} is typing...`);
      });

      // Error handling
      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from chat');
      });

    } catch (err) {
      console.error('Socket initialization error:', err);
    }
  };

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  const fetchMembers = async () => {
    try {
      const res = await axiosAuth.get(`/api/groups/${roomId}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() && socketRef.current) {
      // Emit message through Socket.io
      socketRef.current.emit('message:send', {
        groupId: roomId,
        text: messageInput,
        mediaUrl: null
      });
      
      // Clear input
      setMessageInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const removeMember = async (userId) => {
    if (window.confirm('Remove this member from the room?')) {
      try {
        await axiosAuth.delete(`/api/groups/${roomId}/members/${userId}`);
        fetchMembers();
      } catch (err) {
        console.error('Error removing member:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {loading ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-400">Loading room...</p>
          </div>
        </div>
      ) : !isMember ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <p className="text-xl text-gray-400">You don't have access to this room</p>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 h-screen">
        {/* Main Video Area */}
        <div className="lg:col-span-3 flex flex-col rounded-xl overflow-hidden bg-black">
          {/* Video Stream */}
          <div className="flex-1 bg-gradient-to-br from-slate-800 to-black flex items-center justify-center relative overflow-hidden">
            {isCameraOn ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-6xl">📹</div>
                <p className="text-gray-400 text-lg">Camera is off</p>
                <p className="text-gray-500 text-sm">Click the camera button to turn it on</p>
              </div>
            )}

            {/* Status Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-2 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${isCameraOn ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">{isCameraOn ? 'Camera On' : 'Camera Off'}</span>
            </div>

            {/* Participant Grid */}
            {participants.length > 0 && (
              <div className="absolute bottom-4 right-4 flex gap-2 flex-wrap max-w-xs">
                {participants.map((p) => (
                  <div key={p.id} className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-300">
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="bg-gray-900/80 backdrop-blur px-6 py-4 flex items-center justify-center gap-4 flex-wrap">
            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={`btn-icon ${isCameraOn ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'}`}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? '📹' : '📷'}
            </button>

            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={`btn-icon ${isMicOn ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'}`}
              title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
            >
              {isMicOn ? '🎙️' : '🔇'}
            </button>

            {/* Show Members */}
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="btn-icon bg-white text-gray-900"
              title="Show members"
            >
              👥
            </button>

            {/* Chat Toggle (Mobile) */}
            <button
              onClick={() => setShowChat(!showChat)}
              className="btn-icon bg-white text-gray-900 lg:hidden"
              title="Toggle chat"
            >
              💬
            </button>

            {/* End Call */}
            <button 
              onClick={() => navigate('/groups')}
              className="btn-icon bg-red-600 text-white hover:bg-red-700" 
              title="End call"
            >
              📞
            </button>
          </div>
        </div>

        {/* Right Panel - Chat/Members */}
        <div className={`flex flex-col bg-gray-900 rounded-xl overflow-hidden ${showChat || showMembers ? 'block' : 'hidden'} lg:flex`}>
          {/* Tabs */}
          <div className="flex gap-2 bg-gray-800 p-2 border-b border-gray-700">
            <button
              onClick={() => { setShowChat(true); setShowMembers(false); }}
              className={`flex-1 py-2 px-3 rounded font-medium transition ${showChat ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => { setShowMembers(true); setShowChat(false); }}
              className={`flex-1 py-2 px-3 rounded font-medium transition ${showMembers ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              👥 Members
            </button>
          </div>

          {/* Chat Section */}
          {showChat && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <p className="text-2xl mb-2">💬</p>
                      <p className="text-sm">No messages yet</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="animate-slideInUp">
                      <div className="text-xs font-semibold text-blue-400 mb-1">{msg.sender}</div>
                      <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm break-words">
                        {msg.text}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-700 bg-gray-800 p-3 gap-2 flex">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={sendMessage}
                  className="btn-icon bg-blue-600 text-white hover:bg-blue-700"
                  title="Send message"
                >
                  ➤
                </button>
              </div>
            </>
          )}

          {/* Members Section */}
          {showMembers && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {members.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No members yet</p>
                  </div>
                ) : (
                  members.map((member) => (
                    <div key={member._id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{member.user.name}</div>
                        <div className="text-xs text-gray-400">{member.role}</div>
                      </div>
                      {user.id === member.user._id && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">You</span>
                      )}
                      {member.role === 'owner' && (
                        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Owner</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
