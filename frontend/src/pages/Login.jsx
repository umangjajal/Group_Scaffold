import React, { useState, useEffect } from 'react';
import { publicApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import realtimeLogo from '../assets/realtimeLogo';
import { buildBackendUrl } from '../network/config';
import {
  auth,
  googleProvider,
  signInWithPopup,
  assertFirebaseConfigured,
  getFirebaseAuthErrorMessage,
} from '../firebase';

export default function Login() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const refresh = params.get('refresh');
    if (token) {
      publicApi
        .get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          saveAuth({ user: res.data, accessToken: token, refreshToken: refresh });
          navigate('/groups');
        })
        .catch(() => setError('OAuth login failed.'));
    }
  }, [location, saveAuth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await publicApi.post('/auth/login', {
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

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      assertFirebaseConfigured();
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await publicApi.post('/auth/firebase-verify', { idToken });

      saveAuth(res.data);
      navigate('/groups');
    } catch (err) {
      console.error('Google Auth Error:', err);
      setError(getFirebaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    let url = buildBackendUrl('/api/auth/github');
    // If we are on localhost, tell the backend to redirect back to localhost
    if (window.location.hostname === 'localhost') {
      url += '?state=local';
    }
    window.location.href = url;
  };

  return (
    <div className="auth-page">
      <div className="auth-frame">
        <div className="auth-brand">
          <img src={realtimeLogo} alt="Realtime Group logo" className="auth-brand__logo" />
          <h1 className="auth-brand__title">Realtime Group</h1>
          <p className="auth-brand__subtitle">
            One login for engineers, product teams, and admins.
          </p>
        </div>

        <section className="auth-card" aria-label="Sign in form">
          <h2 className="auth-card__heading">Sign in</h2>
          <p className="auth-card__subheading">Continue to your collaboration workspace.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="auth-label" htmlFor="identifier">
                Email or phone
              </label>
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
              <label className="auth-label" htmlFor="password">
                Password
              </label>
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
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary auth-submit">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <div className="social-btns">
              <button
                type="button"
                className="btn-social"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                Google
              </button>
              <button type="button" className="btn-social" onClick={handleGithubLogin}>
                GitHub
              </button>
            </div>
          </form>

          <p className="auth-card__footer">
            Need an account? <Link to="/signup">Create one</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
