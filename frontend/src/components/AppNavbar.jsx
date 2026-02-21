import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 bg-slate-900/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <Link to="/" className="text-white text-xl font-bold">🎬 Realtime Group</Link>

        <button
          className="md:hidden text-white"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link to="/groups" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Dashboard</Link>
              <Link to="/profile" className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">Profile</Link>
              <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Login</Link>
              <Link to="/signup" className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">Sign Up</Link>
            </>
          )}
          <Link to="/admin-login" className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600">Admin</Link>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-2 bg-slate-900/95">
          {user ? (
            <>
              <Link to="/groups" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Dashboard</Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg bg-purple-600 text-white">Profile</Link>
              <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-left">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Login</Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg bg-purple-600 text-white">Sign Up</Link>
            </>
          )}
          <Link to="/admin-login" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white">Admin</Link>
        </div>
      )}
    </nav>
  );
}
