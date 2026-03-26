import React from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  CalendarIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

export default function RoomCard({ room, onJoin, isMember }) {
  const isPrivate = room.isPrivate;

  return (
    <article className="group relative flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1">
      {/* Visual Banner */}
      <div
        className={`h-24 w-full transition-colors duration-500 ${isPrivate ? 'bg-slate-900' : 'bg-blue-600 group-hover:bg-blue-500'}`}
      >
        <div className="flex justify-end p-4">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${
              isPrivate
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-blue-400/20 text-white border-blue-300/30'
            }`}
          >
            {isPrivate ? (
              <LockClosedIcon className="w-3 h-3" />
            ) : (
              <GlobeAltIcon className="w-3 h-3" />
            )}
            {isPrivate ? 'Private' : 'Public'}
          </span>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <div className="flex-1">
          <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2 group-hover:text-blue-600 transition-colors">
            {room.name}
          </h3>

          {room.description ? (
            <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-4 leading-relaxed italic">
              "{room.description}"
            </p>
          ) : (
            <div className="h-[2.5rem] mb-4" />
          )}

          {isPrivate && room.roomCode && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Entry Code
              </span>
              <span className="text-sm font-mono font-bold text-slate-700 tracking-widest">
                {room.roomCode}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-slate-400" title="Members">
              <UsersIcon className="w-4 h-4" />
              <span className="text-xs font-bold">{room.memberCount || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400" title="Created Date">
              <CalendarIcon className="w-4 h-4" />
              <span className="text-xs font-bold">
                {new Date(room.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {isMember ? (
            <Link
              to={`/room/${room._id}`}
              className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all hover:scale-110 active:scale-95"
            >
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          ) : (
            <button
              onClick={onJoin}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <PlusIcon className="w-4 h-4" /> Join
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
