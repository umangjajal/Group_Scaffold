import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Login() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        identifier: identifier.trim(),
        password,
      });

      saveAuth(res.data);
      const destination = res.data?.user?.role === 'admin' ? '/admin' : '/groups';
      navigate(destination);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-frame">
        <div className="auth-brand">
          <img src="/realtime-logo.svg" alt="Realtime Group logo" className="auth-brand__logo" />
          <h1 className="auth-brand__title">Realtime Group</h1>
          <p className="auth-brand__subtitle">One login for engineers, product teams, and admins.</p>
        </div>

        <section className="auth-card glass-panel" aria-label="Sign in form">
          <h2 className="auth-card__heading">Sign in</h2>
          <p className="auth-card__subheading">Continue to your collaboration workspace.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="auth-label" htmlFor="identifier">Email or phone</label>
              <input
                id="identifier"
                type="text"
                placeholder="name@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="input-control"
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-control"
              />
            </div>

            <div className="auth-row">
              <span />
              <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary auth-submit">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="auth-card__footer">
            Need an account? <Link to="/signup">Create one</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
