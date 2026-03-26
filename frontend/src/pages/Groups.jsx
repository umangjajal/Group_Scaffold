import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RoomCreationModal from '../components/RoomCreationModal';
import JoinByCodeModal from '../components/JoinByCodeModal';
import RoomCard from '../components/RoomCard';
import AppNavbar from '../components/AppNavbar';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  KeyIcon,
  Squares2X2Icon,
  GlobeAltIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      const groupsWithMembership = await Promise.all(
        res.data.map(async (group) => {
          try {
            const memberRes = await api.get(`/groups/${group._id}/members`);
            const userId = user?._id || user?.id;
            const isMember = memberRes.data.some(
              (m) => (m.user && m.user._id === userId) || m.userId === userId || m._id === userId,
            );
            return { ...group, isMember };
          } catch (_) {
            return { ...group, isMember: false };
          }
        }),
      );
      setGroups(groupsWithMembership);
    } catch (err) {
      setError('Failed to load rooms. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const createRoom = async (roomData) => {
    try {
      const res = await api.post('/groups', roomData);
      const newRoom = res.data.group;
      setGroups((prev) => [{ ...newRoom, isMember: true }, ...prev]);
      setIsModalOpen(false);
      setMessage('New workspace ready.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Creation failed');
    }
  };

  const joinGroup = async (id) => {
    try {
      await api.post(`/groups/${id}/join`);
      navigate(`/room/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Join failed');
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'public' && !g.isPrivate) ||
      (filterType === 'private' && g.isPrivate);
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: groups.length,
    public: groups.filter((g) => !g.isPrivate).length,
    private: groups.filter((g) => g.isPrivate).length,
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-blue-100">
      <AppNavbar />

      <main className="pt-24 pb-20 px-6 max-w-[1400px] mx-auto">
        {/* Header Section */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Team <span className="text-blue-600">Dashboard</span>
            </h1>
            <p className="text-lg text-slate-500 font-medium">
              Manage your active workspaces and collaborative projects.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsJoinCodeModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm"
            >
              <KeyIcon className="w-5 h-5 text-slate-400" />
              Join by Code
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 transform hover:-translate-y-0.5 active:scale-95"
            >
              <PlusIcon className="w-5 h-5" />
              Create Room
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[
            {
              label: 'Total Rooms',
              value: stats.total,
              icon: Squares2X2Icon,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: 'Public Spaces',
              value: stats.public,
              icon: GlobeAltIcon,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: 'Private Rooms',
              value: stats.private,
              icon: LockClosedIcon,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm transition-all hover:shadow-md"
            >
              <div
                className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}
              >
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {stat.label}
                </p>
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Alerts */}
        {message && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-bold flex items-center gap-2 animate-in fade-in zoom-in duration-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {message}
          </div>
        )}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold animate-in shake duration-300">
            {error}
          </div>
        )}

        {/* Filter & Search Bar */}
        <section className="sticky top-24 z-40 bg-white/80 backdrop-blur-xl border border-slate-200/60 p-3 rounded-[2rem] shadow-xl shadow-slate-200/40 mb-12 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search workspaces..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
            {['all', 'public', 'private'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  filterType === type
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* Room Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">
              Syncing workspaces...
            </p>
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {filteredGroups.map((room) => (
              <RoomCard
                key={room._id}
                room={room}
                onJoin={() => joinGroup(room._id)}
                isMember={room.isMember || false}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white border border-slate-200 border-dashed rounded-[3rem]">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Squares2X2Icon className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              No workspaces found
            </h3>
            <p className="text-slate-500 font-medium mt-2 max-w-xs">
              {searchTerm
                ? `Nothing matches "${searchTerm}" in ${filterType} rooms.`
                : 'Your dashboard is currently empty. Start by creating a new workspace.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-8 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20"
              >
                Create Your First Room
              </button>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <RoomCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateRoom={createRoom}
      />
      <JoinByCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        onSuccess={(groupId) => navigate(`/room/${groupId}`)}
      />
    </div>
  );
}
