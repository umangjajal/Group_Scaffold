import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import api from '../api';
import { UserCircleIcon, UserIcon, CheckBadgeIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from '@heroicons/react/24/solid';

export default function MemberListComponent({ groupId }) {
  const [members, setMembers] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/members`);
        setMembers(data);
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };
    fetchMembers();

    const onPresence = ({ userId, status }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (status === 'online') next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on('presence', onPresence);
    return () => {
      socket.off('presence', onPresence);
    };
  }, [groupId]);

  const displayedMembers = showAll ? members : members.slice(0, 3);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#252526]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Team Members</h3>
        <span className="px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 text-[10px] font-bold">
          {onlineUsers.size} Online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {displayedMembers.map(m => {
          const isOnline = onlineUsers.has(m.user._id);
          return (
            <div key={m._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2d2d2d] group transition-all cursor-default">
              <div className="relative flex-shrink-0">
                {m.user.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt={m.user.name} className="w-8 h-8 rounded-full object-cover border border-[#333]" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#3c3c3c] flex items-center justify-center text-gray-400 border border-[#444]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1e1e1e] ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-200 truncate">{m.user.name}</span>
                  {m.role === 'owner' && <CheckBadgeIcon className="w-3.5 h-3.5 text-yellow-500" title="Room Owner" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 capitalize">{m.role}</span>
                  {isOnline && <span className="text-[9px] text-green-500 font-bold uppercase tracking-tighter">Active Now</span>}
                </div>
              </div>
            </div>
          );
        })}

        {members.length > 3 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-[11px] font-bold text-gray-500 hover:text-blue-400 hover:bg-[#252526] rounded-lg transition-all border border-dashed border-[#333] hover:border-blue-500/30"
          >
            {showAll ? (
              <>Show Less <ChevronUpIcon className="w-3 h-3" /></>
            ) : (
              <>+ {members.length - 3} More Members <ChevronDownIcon className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>

      <div className="p-4 bg-[#252526] border-t border-[#333]">
        <button 
          className="w-full py-2 bg-[#3c3c3c] hover:bg-[#444] text-gray-300 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-2"
          onClick={() => alert('Invite system coming soon!')}
        >
          <PlusIcon className="w-4 h-4" /> Invite Member
        </button>
      </div>
    </div>
  );
}
