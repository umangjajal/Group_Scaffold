import React from 'react';
import { Link } from 'react-router-dom';

export default function RoomCard({ room, onJoin, isMember }) {
  const isPrivate = room.isPrivate;

  return (
    <article className="room-card">
      <div className={`room-card__banner ${isPrivate ? 'is-private' : ''}`} />

      <div className="room-card__body">
        <h3 className="room-card__title line-clamp-2">{room.name}</h3>
        <span className={`pill ${isPrivate ? '' : 'pill--active'}`}>{isPrivate ? 'Private' : 'Public'}</span>

        {room.description && <p className="room-card__description line-clamp-2">{room.description}</p>}

        {room.isPrivate && room.roomCode && (
          <div className="room-card__code">
            <p className="room-card__code-label">Room Code</p>
            <div className="room-card__code-value">{room.roomCode}</div>
          </div>
        )}

        <div className="room-card__meta">
          <div>
            <strong>{room.memberCount || 0}</strong>
            members
          </div>
          {room.createdAt && (
            <div>
              <strong>
                {new Date(room.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </strong>
              created
            </div>
          )}
        </div>

        {isMember ? (
          <Link to={`/room/${room._id}`} className="btn btn--secondary room-card__action">
            Open Room
          </Link>
        ) : (
          <button onClick={onJoin} className="btn btn--primary room-card__action">
            Join Room
          </button>
        )}
      </div>
    </article>
  );
}
