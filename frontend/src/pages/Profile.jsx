import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Profile() {
  const { user, saveAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateProfile = async () => {
    setError('');
    setMessage('');
    try {
      const res = await axios.put(`${API_URL}/api/me`, { name, avatarUrl });
      saveAuth({ ...res.data.user, accessToken: localStorage.getItem('accessToken'), refreshToken: localStorage.getItem('refreshToken') });
      setMessage('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  return (
    <div>
      <h2>Profile</h2>
      <div>
        <label>Name:</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label>Avatar URL:</label>
        <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
      </div>
      <button onClick={updateProfile}>Update Profile</button>
      {message && <p style={{color:'green'}}>{message}</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
    </div>
  );
}