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
    <div className="modal-overlay">
      <div className="modal-card glass-panel">
        <h2>Create Room</h2>
        <p className="modal-subtitle">Define a new collaboration room for your team.</p>

        {error && <div className="dashboard-alert dashboard-alert--error" style={{ marginTop: '0.8rem', marginBottom: 0 }}>{error}</div>}

        <div className="workspace-form-grid" style={{ marginTop: '0.85rem' }}>
          <div>
            <label className="auth-label" htmlFor="new-room-name">Room Name</label>
            <input
              id="new-room-name"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Mobile Platform Squad"
              className="input-control"
            />
          </div>

          <div>
            <label className="auth-label" htmlFor="new-room-description">Description</label>
            <textarea
              id="new-room-description"
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              placeholder="Add context for this room"
              rows={3}
              className="textarea-control"
            />
          </div>

          <label className="pill" style={{ width: 'fit-content', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ marginRight: '0.45rem' }}
            />
            {isPrivate ? 'Private Room' : 'Public Room'}
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} disabled={loading} className="btn btn--ghost">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading} className="btn btn--primary">
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
