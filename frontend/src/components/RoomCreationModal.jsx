import React, { useState } from 'react';

export default function RoomCreationModal({ isOpen, onClose, onCreateRoom }) {
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onCreateRoom({
        name: roomName,
        description: roomDescription,
        isPrivate,
      });
      setRoomName('');
      setRoomDescription('');
      setIsPrivate(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-8 animate-slideIn">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Create New Room</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Room Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Web Dev Team"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Room Description Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              placeholder="Add a description for this room..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="flex items-center h-6">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="private" className="text-sm font-medium text-gray-900 cursor-pointer">
                  {isPrivate ? '🔒 Private Room' : '🌍 Public Room'}
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  {isPrivate
                    ? 'Only invited members can join'
                    : 'Anyone can discover and join'}
                </p>
              </div>
            </div>
          </div>

          {/* Room Type Summary */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
            Creating a <strong>{isPrivate ? 'private' : 'public'}</strong> room
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
