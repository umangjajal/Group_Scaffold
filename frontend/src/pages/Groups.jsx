import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import RoomCreationModal from "../components/RoomCreationModal";
import JoinByCodeModal from "../components/JoinByCodeModal";
import RoomCard from "../components/RoomCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, public, private
  const navigate = useNavigate();
  const { user } = useAuth();

  const token = localStorage.getItem("accessToken");

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  axiosAuth.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        setError("Unauthorized. Please login again.");
        setTimeout(() => navigate("/login"), 1500);
      }
      return Promise.reject(error);
    }
  );

  const fetchGroups = async () => {
    setError("");
    try {
      const res = await axiosAuth.get("/api/groups");
      
      // Check membership status for each group
      const groupsWithMembership = await Promise.all(
        res.data.map(async (group) => {
          try {
            // Try to fetch group details to check membership
            const memberRes = await axiosAuth.get(`/api/groups/${group._id}/members`);
            const isMember = memberRes.data.some(m => m._id === user._id || m.userId === user._id);
            return { ...group, isMember };
          } catch (err) {
            // Assume not a member if we can't check
            return { ...group, isMember: false };
          }
        })
      );
      
      setGroups(groupsWithMembership);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load rooms");
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const createRoom = async (roomData) => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosAuth.post("/api/groups", roomData);
      const newRoomId = res.data.group._id;
      setMessage("Room created successfully! 🎉");
      setIsModalOpen(false);
      setTimeout(() => {
        navigate(`/room/${newRoomId}`);
      }, 500);
    } catch (err) {
      throw new Error(err.response?.data?.error || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (id) => {
    setError("");
    setMessage("");
    try {
      await axiosAuth.post(`/api/groups/${id}/join`);
      setMessage("Successfully joined! 🎊");
      setTimeout(() => {
        navigate(`/room/${id}`);
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to join room");
    }
  };

  // Filter and search logic
  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = 
      filterType === "all" ||
      (filterType === "public" && !g.isPrivate) ||
      (filterType === "private" && g.isPrivate);
    return matchesSearch && matchesFilter;
  });

  const publicRooms = groups.filter(g => !g.isPrivate);
  const privateRooms = groups.filter(g => g.isPrivate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container-main py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back! 👋</h1>
              <p className="text-blue-100">Manage your rooms and connect with others</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/admin"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
              >
                👨‍💼 Admin
              </Link>
              <button
                onClick={() => setIsJoinCodeModalOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
              >
                <span className="text-lg mr-2">🔐</span>
                Join with Code
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary bg-white text-blue-600 hover:bg-blue-50"
              >
                <span className="text-lg mr-2">➕</span>
                Create Room
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-blue-100 text-sm font-medium mb-1">Total Rooms</div>
              <div className="text-3xl font-bold text-white">{groups.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-blue-100 text-sm font-medium mb-1">Public</div>
              <div className="text-3xl font-bold text-white">{publicRooms.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-blue-100 text-sm font-medium mb-1">Private</div>
              <div className="text-3xl font-bold text-white">{privateRooms.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-main py-12">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-slideIn">
            <div className="flex items-center gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <div className="font-semibold text-red-900">Error</div>
                <div className="text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg animate-slideIn">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div className="text-green-700 font-medium">{message}</div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search rooms by name or description..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              {["all", "public", "private"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filterType === type
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {type === "all" && "All Rooms"}
                  {type === "public" && "🌍 Public"}
                  {type === "private" && "🔒 Private"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rooms Grid */}
        {filteredGroups.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {filterType === "all" && "All Rooms"}
              {filterType === "public" && "Public Rooms"}
              {filterType === "private" && "Private Rooms"}
              <span className="text-gray-500 text-lg font-normal ml-2">({filteredGroups.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map((room) => (
                <RoomCard
                  key={room._id}
                  room={room}
                  onJoin={() => joinGroup(room._id)}
                  isMember={room.isMember || false}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 card">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {searchTerm ? "No rooms found" : "No rooms yet"}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Create your first room to get started!"}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary"
              >
                <span className="text-lg mr-2">➕</span>
                Create Your First Room
              </button>
            )}
          </div>
        )}
      </div>

      {/* Room Creation Modal */}
      <RoomCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateRoom={createRoom}
      />

      {/* Join by Code Modal */}
      <JoinByCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        onSuccess={(groupId) => {
          setIsJoinCodeModalOpen(false);
          setMessage("Successfully joined the room! 🎉");
          setTimeout(() => {
            navigate(`/room/${groupId}`);
          }, 500);
        }}
      />

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 flex items-center justify-center text-2xl md:hidden"
        title="Create new room"
      >
        ➕
      </button>
    </div>
  );
}
