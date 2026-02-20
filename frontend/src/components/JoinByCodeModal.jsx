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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">🔐 Join Private Room</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleJoinByCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-Digit Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono font-bold tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">Enter only numbers (0-9)</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRoomCode('');
                  setError('');
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || roomCode.length !== 6}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
