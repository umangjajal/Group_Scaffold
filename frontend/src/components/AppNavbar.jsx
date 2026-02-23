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
    <nav className="app-nav">
      <div className="container-main app-nav__inner">
        <Link to="/" className="app-nav__brand" onClick={() => setIsOpen(false)}>
          <img src="/realtime-logo.svg" alt="Realtime Group" />
          <span className="app-nav__title">Realtime Group</span>
        </Link>

        <button
          className="app-nav__menu-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {isOpen ? 'x' : '='}
        </button>

        <div className="app-nav__actions">
          {user ? (
            <>
              <Link to="/groups" className="btn btn--secondary">Dashboard</Link>
              <Link to="/profile" className="btn btn--ghost">Profile</Link>
              <button onClick={handleLogout} className="btn btn--danger">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--secondary">Sign In</Link>
              <Link to="/signup" className="btn btn--primary">Create Account</Link>
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="container-main app-nav__mobile">
          {user ? (
            <>
              <Link to="/groups" onClick={() => setIsOpen(false)} className="btn btn--secondary">Dashboard</Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className="btn btn--ghost">Profile</Link>
              <button onClick={handleLogout} className="btn btn--danger">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setIsOpen(false)} className="btn btn--secondary">Sign In</Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="btn btn--primary">Create Account</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
