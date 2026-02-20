import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, groups: 0, messages: 0 });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const adminToken = localStorage.getItem('adminToken');

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  useEffect(() => {
    // Check if admin is logged in
    if (!adminToken) {
      navigate('/admin-login');
      return;
    }
    
    fetchUsers();
    fetchStats();
    
    // Refresh data every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchUsers();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axiosAuth.get('/api/admin/users');
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load users');
      console.error('Error fetching users:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axiosAuth.get('/api/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const addMembersToRoom = async () => {
    if (!roomId) {
      setError('Please enter a room ID');
      return;
    }

    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    try {
      setError('');
      for (let userId of selectedUsers) {
        await axiosAuth.post(`/api/groups/${roomId}/members/${userId}`);
      }
      setSuccess(`Successfully added ${selectedUsers.length} member(s) to the room!`);
      setSelectedUsers([]);
      setRoomId('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add members');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminEmail');
    navigate('/admin-login');
  };

  const onlineCount = stats.online || 0;
  const offlineCount = stats.offline || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logout */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">👨‍💼 Admin Dashboard</h1>
            <p className="text-slate-400">Welcome, {localStorage.getItem('adminName') || 'Admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
          >
            Logout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm font-medium">Total Users</div>
            <div className="text-3xl font-bold text-white mt-2">{stats.total || 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-green-500/30">
            <div className="text-green-400 text-sm font-medium">Online Now</div>
            <div className="text-3xl font-bold text-green-400 mt-2">{onlineCount}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-gray-500/30">
            <div className="text-gray-400 text-sm font-medium">Offline</div>
            <div className="text-3xl font-bold text-gray-400 mt-2">{offlineCount}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm font-medium">Groups</div>
            <div className="text-3xl font-bold text-white mt-2">{stats.groups || 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-slate-400 text-sm font-medium">Messages</div>
            <div className="text-3xl font-bold text-white mt-2">{stats.messages || 0}</div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg animate-slideIn">
            <p className="text-red-300 font-medium">❌ {error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg animate-slideIn">
            <p className="text-green-300 font-medium">✅ {success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Users List */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
              <h2 className="text-xl font-bold">📋 Users ({users.length})</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No users found</div>
            ) : (
              <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => toggleUserSelection(user._id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-sm text-slate-400">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      <span className="text-sm text-slate-300">
                        {user.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add to Room */}
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6">
            <h3 className="text-xl font-bold text-white mb-4">➕ Add Members</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID..."
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Selected Users
                </label>
                <div className="bg-slate-700/50 rounded-lg p-3 min-h-20 max-h-40 overflow-y-auto border border-slate-600">
                  {selectedUsers.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No users selected</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUsers.map((userId) => {
                        const user = users.find((u) => u._id === userId);
                        return (
                          <div
                            key={userId}
                            className="flex items-center justify-between bg-slate-600 rounded px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-white">{user?.name}</span>
                            <button
                              onClick={() => toggleUserSelection(userId)}
                              className="text-red-400 hover:text-red-300 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      <div className="text-xs text-blue-400 font-medium pt-2 border-t border-slate-500">
                        {selectedUsers.length} user(s) selected
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={addMembersToRoom}
                disabled={selectedUsers.length === 0 || !roomId}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {selectedUsers.length > 0 ? selectedUsers.length : ''} Member(s)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
