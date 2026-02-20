import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AppNavbar from '../components/AppNavbar';
import { AVATAR_PRESETS } from '../constants/avatarPresets';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Profile() {
  const { user, saveAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || 'other');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const joinedOn = useMemo(() => {
    if (!user?.createdAt) return 'Recently joined';
    return new Date(user.createdAt).toLocaleDateString();
  }, [user]);

  const updateProfile = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.put(
        `${API_URL}/api/auth/me`,
        { name, avatarUrl, phone, gender },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      saveAuth({
        user: res.data.user,
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
      });
      setMessage('Profile updated successfully ✨');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const currentPreset = AVATAR_PRESETS[gender] || AVATAR_PRESETS.other;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <AppNavbar />
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white/10 border border-white/20 rounded-2xl p-6 text-white">
          <img
            src={avatarUrl || currentPreset[0]}
            alt="avatar"
            className="w-32 h-32 rounded-full object-cover border-4 border-indigo-400 mx-auto"
          />
          <h2 className="text-center mt-4 text-2xl font-bold">{name || 'User'}</h2>
          <p className="text-center text-indigo-200">{user?.email || 'No email'}</p>
          <div className="mt-6 space-y-2 text-sm">
            <div>🏷️ Role: <span className="font-semibold">{user?.role || 'user'}</span></div>
            <div>💎 Plan: <span className="font-semibold uppercase">{user?.plan || 'free'}</span></div>
            <div>🧬 Gender: <span className="font-semibold capitalize">{gender}</span></div>
            <div>📅 Joined: <span className="font-semibold">{joinedOn}</span></div>
            <div>✅ Email Verified: <span className="font-semibold">{user?.emailVerified ? 'Yes' : 'No'}</span></div>
            <div>📱 Phone Verified: <span className="font-semibold">{user?.phoneVerified ? 'Yes' : 'No'}</span></div>
            <div>🛡️ Status: <span className="font-semibold capitalize">{user?.status || 'active'}</span></div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl shadow-2xl p-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Edit Profile</h3>

          {message && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">{message}</div>}
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => {
                  const nextGender = e.target.value;
                  setGender(nextGender);
                  if (!avatarUrl) {
                    setAvatarUrl((AVATAR_PRESETS[nextGender] || AVATAR_PRESETS.other)[0]);
                  }
                }}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-2">Choose an Avatar</label>
              <div className="grid grid-cols-4 gap-3">
                {currentPreset.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setAvatarUrl(avatar)}
                    className={`rounded-full p-1 border-2 ${avatarUrl === avatar ? 'border-indigo-600' : 'border-transparent'} hover:border-indigo-400`}
                    title="Select avatar"
                  >
                    <img src={avatar} alt="avatar preset" className="w-16 h-16 rounded-full" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 9999999999"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Avatar URL (Optional)</label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              onClick={updateProfile}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
