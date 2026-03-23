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
    <div className="modal-overlay bg-black/40 backdrop-blur-sm">
      <div className="modal-card bg-white border border-gray-100 rounded-2xl shadow-2xl p-8 font-sans max-w-md w-full mx-4">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">Create Room</h2>
        <p className="text-sm text-gray-500 mb-8 font-medium">Define a new collaboration space for your team.</p>

        {error && <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-lg mb-6 animate-shake">{error}</div>}

        <div className="flex flex-col gap-6">
          <div className="group">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-widest mb-2 block group-focus-within:text-[#007acc] transition-colors" htmlFor="new-room-name">Room Name</label>
            <input
              id="new-room-name"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Mobile Platform Squad"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:bg-white focus:border-[#007acc] focus:ring-4 focus:ring-[#007acc]/10 focus:outline-none transition-all placeholder:text-gray-300"
            />
          </div>

          <div className="group">
            <label className="text-[11px] uppercase font-bold text-gray-400 tracking-widest mb-2 block group-focus-within:text-[#007acc] transition-colors" htmlFor="new-room-description">Description</label>
            <textarea
              id="new-room-description"
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              placeholder="Add context for this room"
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 focus:bg-white focus:border-[#007acc] focus:ring-4 focus:ring-[#007acc]/10 focus:outline-none transition-all placeholder:text-gray-300 resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer w-fit group select-none">
            <div className="relative flex items-center">
                <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 appearance-none border-2 border-gray-200 rounded-md checked:bg-[#007acc] checked:border-[#007acc] transition-all cursor-pointer"
                />
                {isPrivate && (
                    <svg className="absolute w-3.5 h-3.5 text-white left-[3px] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">
                {isPrivate ? 'Private Room' : 'Public Room'}
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-4 mt-10 pt-6 border-t border-gray-50">
          <button 
            onClick={onClose} 
            disabled={loading} 
            className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate} 
            disabled={loading} 
            className="px-8 py-2.5 bg-[#007acc] hover:bg-[#0062a3] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#007acc]/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? '...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
