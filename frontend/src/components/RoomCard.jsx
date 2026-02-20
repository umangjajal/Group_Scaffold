import React from 'react';
import { Link } from 'react-router-dom';

export default function RoomCard({ room, onJoin, isMember }) {
  const isPrivate = room.isPrivate;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      {/* Header with background gradient */}
      <div className={`h-32 bg-gradient-to-br ${
        isPrivate 
          ? 'from-purple-500 to-purple-600' 
          : 'from-blue-500 to-blue-600'
      } relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-2 text-white text-4xl">
            {isPrivate ? '🔒' : '🌍'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
              {room.name}
            </h3>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
              isPrivate
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {isPrivate ? '🔒 Private' : '🌍 Public'}
            </span>
          </div>
        </div>

        {room.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {room.description}
          </p>
        )}

        {/* Room Code for Private Rooms */}
        {room.isPrivate && room.roomCode && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-purple-600 font-medium mb-1">🔐 Room Code</div>
            <div className="text-lg font-bold text-purple-700 font-mono tracking-widest">
              {room.roomCode}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 mb-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <div>
              <div className="text-xl font-bold text-gray-900">{room.memberCount || 0}</div>
              <div className="text-xs text-gray-500">members</div>
            </div>
          </div>
          {room.createdAt && (
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <div>
                <div className="text-xs font-semibold text-gray-900">
                  {new Date(room.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-xs text-gray-500">created</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="space-y-2">
          {isMember ? (
            <Link
              to={`/room/${room._id}`}
              className="block w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              💬 Open Chat
            </Link>
          ) : (
            <button
              onClick={onJoin}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✨ Join Room
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
