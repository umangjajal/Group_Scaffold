import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bars3Icon, 
  XMarkIcon, 
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isHome = location.pathname === '/';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
      scrolled || !isHome ? 'bg-white/80 backdrop-blur-md border-b border-gray-200 py-3 shadow-sm' : 'bg-transparent py-5'
    }`}>
      <div className="container-main flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" onClick={() => setIsOpen(false)}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
             <img src="/realtime-logo.svg" alt="Logo" className="w-6 h-6 invert" />
          </div>
          <span className={`text-xl font-black tracking-tight ${!scrolled && isHome ? 'text-blue-900' : 'text-gray-900'}`}>
            Realtime<span className="text-blue-600">Group</span>
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <Link to="/groups" className="text-sm font-bold text-gray-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
                <Squares2X2Icon className="w-5 h-5" /> Dashboard
              </Link>
              <Link to="/profile" className="text-sm font-bold text-gray-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
                <UserCircleIcon className="w-5 h-5" /> Profile
              </Link>
              <div className="h-6 w-[1px] bg-gray-200 mx-2" />
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <ArrowRightOnRectangleIcon className="w-5 h-5" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors">Sign In</Link>
              <Link to="/signup" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden p-2 text-gray-600" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 p-4 flex flex-col gap-3 shadow-xl animate-in fade-in slide-in-from-top-4">
          {user ? (
            <>
              <Link to="/groups" onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-gray-700 font-bold">
                <Squares2X2Icon className="w-6 h-6 text-blue-600" /> Dashboard
              </Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-gray-700 font-bold">
                <UserCircleIcon className="w-6 h-6 text-blue-600" /> Profile
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 text-red-500 font-bold">
                <ArrowRightOnRectangleIcon className="w-6 h-6" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setIsOpen(false)} className="p-3 text-center text-gray-700 font-bold border border-gray-100 rounded-lg">Sign In</Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="p-3 text-center bg-blue-600 text-white font-bold rounded-lg shadow-lg">Create Account</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
