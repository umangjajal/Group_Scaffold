import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    offlineUsers: 0,
    totalGroups: 0,
    totalMessages: 0,
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuth();

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role !== 'admin') {
      navigate('/groups');
      return;
    }

    fetchUsers();
    fetchStats();

    const interval = setInterval(() => {
      fetchUsers();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  const fetchUsers = async () => {
    try {
      const response = await axiosAuth.get('/api/admin/users');
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axiosAuth.get('/api/admin/stats');
      setStats(response.data);
    } catch (_) {
      // No-op to keep panel running when stats endpoint is temporarily unavailable.
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
      for (const userId of selectedUsers) {
        await axiosAuth.post(`/api/groups/${roomId}/members/${userId}`);
      }
      setSuccess(`Added ${selectedUsers.length} member(s) to room.`);
      setSelectedUsers([]);
      setRoomId('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add members');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[#c6a16b] text-sm uppercase tracking-[0.2em] mb-1">Administration</p>
            <h1 className="text-4xl font-display">Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">Welcome, {user?.name || 'Admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-[#c6a16b] hover:bg-[#d4b27f] text-[#0b1f3a] rounded-lg font-semibold transition"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Users" value={stats.totalUsers || 0} />
          <StatCard label="Online" value={stats.onlineUsers || 0} borderClass="border-emerald-400/30" valueClass="text-emerald-400" />
          <StatCard label="Offline" value={stats.offlineUsers || 0} borderClass="border-slate-500/40" />
          <StatCard label="Groups" value={stats.totalGroups || 0} />
          <StatCard label="Messages" value={stats.totalMessages || 0} />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-500/50 rounded-lg text-emerald-200">{success}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0b1f3a] to-[#0f766e] text-white px-6 py-4">
              <h2 className="text-xl font-semibold">Users ({users.length})</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No users found.</div>
            ) : (
              <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                {users.map((account) => (
                  <div key={account._id} className="flex items-center gap-4 p-4 hover:bg-slate-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(account._id)}
                      onChange={() => toggleUserSelection(account._id)}
                      className="w-4 h-4 text-[#0f766e] rounded focus:ring-[#0f766e] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{account.name}</div>
                      <div className="text-sm text-slate-400 truncate">{account.email || account.phone || 'No contact set'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${account.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                      <span className="text-sm text-slate-300">{account.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-700 p-6">
            <h3 className="text-xl font-semibold mb-4">Add Members to Room</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-[#0f766e] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Selected Users</label>
                <div className="bg-slate-800/60 rounded-lg p-3 min-h-20 max-h-40 overflow-y-auto border border-slate-700">
                  {selectedUsers.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No users selected</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUsers.map((id) => {
                        const selected = users.find((u) => u._id === id);
                        return (
                          <div key={id} className="flex items-center justify-between bg-slate-700 rounded px-3 py-2 text-sm">
                            <span className="font-medium text-white truncate">{selected?.name || id}</span>
                            <button onClick={() => toggleUserSelection(id)} className="text-red-400 hover:text-red-300 font-bold">
                              x
                            </button>
                          </div>
                        );
                      })}
                      <div className="text-xs text-[#c6a16b] font-medium pt-2 border-t border-slate-600">
                        {selectedUsers.length} user(s) selected
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={addMembersToRoom}
                disabled={selectedUsers.length === 0 || !roomId}
                className="w-full py-2 px-4 bg-[#0f766e] hover:bg-[#0d675f] text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Selected Members
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, borderClass = '', valueClass = 'text-white' }) {
  return (
    <div className={`bg-slate-900 rounded-lg p-4 border border-slate-700 ${borderClass}`}>
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}
