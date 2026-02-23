import React, { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function JoinByCodeModal({ isOpen, onClose, onSuccess }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('accessToken');

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!roomCode || roomCode.length !== 6 || !/^\d{6}$/.test(roomCode)) {
      setError('Please enter a valid 6-digit room code');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/groups/join-by-code`,
        { roomCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRoomCode('');
      onSuccess(response.data.groupId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel">
        <h2>Join Private Room</h2>
        <p className="modal-subtitle">Paste a valid room access code to join instantly.</p>

        {error && <div className="dashboard-alert dashboard-alert--error" style={{ marginTop: '0.8rem', marginBottom: 0 }}>{error}</div>}

        <form onSubmit={handleJoinByCode} className="workspace-form-grid" style={{ marginTop: '0.85rem' }}>
          <div>
            <label className="auth-label" htmlFor="roomCode">6-digit Room Code</label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength="6"
              className="input-control code-font"
              style={{ textAlign: 'center', letterSpacing: '0.2em' }}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={() => {
                setRoomCode('');
                setError('');
                onClose();
              }}
              className="btn btn--ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || roomCode.length !== 6}
              className="btn btn--primary"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
