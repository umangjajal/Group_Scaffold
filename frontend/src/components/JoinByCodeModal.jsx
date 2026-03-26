import React, { useState } from 'react';
import api from '../api';

export default function JoinByCodeModal({ isOpen, onClose, onSuccess }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const response = await api.post('/groups/join-by-code', { roomCode });

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
    <div className="modal-overlay bg-black/40 backdrop-blur-sm">
      <div className="modal-card bg-white border border-gray-100 rounded-2xl shadow-2xl p-8 font-sans max-w-md w-full mx-4">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">
          Join Private Room
        </h2>
        <p className="text-sm text-gray-500 mb-8 font-medium">
          Paste a valid room access code to join instantly.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-lg mb-6 animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinByCode} className="flex flex-col gap-6">
          <div className="group">
            <label
              className="text-[11px] uppercase font-bold text-gray-400 tracking-widest mb-2 block group-focus-within:text-[#007acc] transition-colors"
              htmlFor="roomCode"
            >
              6-digit Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="0 0 0 0 0 0"
              maxLength="6"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xl font-mono font-bold text-gray-900 text-center tracking-[0.5em] focus:bg-white focus:border-[#007acc] focus:ring-4 focus:ring-[#007acc]/10 focus:outline-none transition-all placeholder:text-gray-200"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-4 mt-4 pt-6 border-t border-gray-50">
            <button
              type="button"
              onClick={() => {
                setRoomCode('');
                setError('');
                onClose();
              }}
              className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || roomCode.length !== 6}
              className="px-8 py-2.5 bg-[#007acc] hover:bg-[#0062a3] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#007acc]/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? '...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
