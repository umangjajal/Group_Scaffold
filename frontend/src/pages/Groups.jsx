import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RoomCreationModal from '../components/RoomCreationModal';
import JoinByCodeModal from '../components/JoinByCodeModal';
import RoomCard from '../components/RoomCard';
import AppNavbar from '../components/AppNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
  const token = localStorage.getItem('accessToken');

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  axiosAuth.interceptors.response.use(
    (response) => response,
    (err) => {
      if (err.response?.status === 401) {
        setError('Unauthorized. Please login again.');
        setTimeout(() => navigate('/login'), 1200);
      }
      return Promise.reject(err);
    }
  );

  const fetchGroups = async () => {
    setError('');
    try {
      const res = await axiosAuth.get('/api/groups');

      const groupsWithMembership = await Promise.all(
        res.data.map(async (group) => {
          try {
            const memberRes = await axiosAuth.get(`/api/groups/${group._id}/members`);
            const userId = user?._id || user?.id;
            const isMember = memberRes.data.some(
              (m) => (m.user && m.user._id === userId) || m.userId === userId || m._id === userId
            );
            return { ...group, isMember };
          } catch (_) {
            return { ...group, isMember: false };
          }
        })
      );

      setGroups(groupsWithMembership);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load rooms');
    }
  };

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async (roomData) => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosAuth.post('/api/groups', roomData);
      const newRoom = res.data.group;
      setCreatedRoom(newRoom);
      setGroups((prev) => [{ ...newRoom, isMember: true }, ...prev]);
      setMessage('Room created successfully.');
      setIsModalOpen(false);
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (id) => {
    setError('');
    setMessage('');
    try {
      await axiosAuth.post(`/api/groups/${id}/join`);
      setMessage('Joined room successfully.');
      setTimeout(() => navigate(`/room/${id}`), 400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join room');
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

  const publicRooms = groups.filter((g) => !g.isPrivate);
  const privateRooms = groups.filter((g) => g.isPrivate);

  return (
    <div className="dashboard-page">
      <AppNavbar />

      <section className="dashboard-hero">
        <div className="container-main">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Team Dashboard</h1>
              <p className="dashboard-subtitle">Create rooms, discover active spaces, and jump into shared execution.</p>
            </div>
            <div className="dashboard-actions">
              <button onClick={() => setIsJoinCodeModalOpen(true)} className="btn btn--ghost">Join by Code</button>
              <button onClick={() => setIsModalOpen(true)} className="btn btn--primary">Create Room</button>
            </div>
          </div>

          <div className="dashboard-stats">
            <article className="stat-card">
              <p className="stat-card__label">Total Rooms</p>
              <p className="stat-card__value">{groups.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Public Rooms</p>
              <p className="stat-card__value">{publicRooms.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Private Rooms</p>
              <p className="stat-card__value">{privateRooms.length}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="container-main dashboard-main">
        {error && <div className="dashboard-alert dashboard-alert--error">{error}</div>}
        {message && <div className="dashboard-alert dashboard-alert--success">{message}</div>}

        {createdRoom && (
          <div className="dashboard-banner">
            <p className="dashboard-banner__title">New room created: {createdRoom.name}</p>
            <p className="dashboard-banner__copy">Share the room code with invited contributors.</p>
            {createdRoom.roomCode && (
              <div className="workspace-row" style={{ marginTop: '0.55rem', maxWidth: '320px' }}>
                <input className="input-control code-font" value={createdRoom.roomCode} readOnly />
                <button
                  className="btn btn--secondary"
                  onClick={() => navigator.clipboard.writeText(createdRoom.roomCode)}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        <div className="dashboard-filters glass-panel">
          <div className="dashboard-filters__row">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search rooms by name or description"
              className="input-control"
            />
            <div className="filter-toggle-group" role="tablist" aria-label="Room type filter">
              {['all', 'public', 'private'].map((type) => (
                <button
                  key={type}
                  role="tab"
                  aria-selected={filterType === type}
                  onClick={() => setFilterType(type)}
                  className={`filter-toggle ${filterType === type ? 'is-active' : ''}`}
                >
                  {type[0].toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredGroups.length > 0 ? (
          <>
            <div className="room-list-heading">
              <h2>{filterType[0].toUpperCase() + filterType.slice(1)} Rooms</h2>
              <span>({filteredGroups.length})</span>
            </div>
            <div className="room-grid">
              {filteredGroups.map((room) => (
                <RoomCard
                  key={room._id}
                  room={room}
                  onJoin={() => joinGroup(room._id)}
                  isMember={room.isMember || false}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="dashboard-empty surface-card">
            <h3>No rooms found</h3>
            <p>{searchTerm ? 'Try a broader search query.' : 'Create your first room to start collaborating.'}</p>
            {!searchTerm && (
              <div style={{ marginTop: '0.9rem' }}>
                <button onClick={() => setIsModalOpen(true)} className="btn btn--primary">Create First Room</button>
              </div>
            )}
          </div>
        )}
      </section>

      <RoomCreationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreateRoom={createRoom} />

      <JoinByCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        onSuccess={(groupId) => {
          setIsJoinCodeModalOpen(false);
          setMessage('Joined room successfully.');
          setTimeout(() => navigate(`/room/${groupId}`), 400);
        }}
      />

      <button onClick={() => setIsModalOpen(true)} className="dashboard-fab" title="Create new room">+</button>
    </div>
  );
}
