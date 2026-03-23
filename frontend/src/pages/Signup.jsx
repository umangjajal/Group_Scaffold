import React, { useState } from 'react';
import { publicApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import realtimeLogo from '../assets/realtimeLogo';
import { buildBackendUrl } from '../network/config';
import {
  auth,
  googleProvider,
  signInWithPopup,
  assertFirebaseConfigured,
  getFirebaseAuthErrorMessage,
} from '../firebase';

export default function Signup() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email && !phone) {
      setError('Please provide either an email or phone number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      };

      const res = await publicApi.post('/auth/register', payload);
      saveAuth(res.data);
      navigate('/groups');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
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
      console.error("Google Auth Error:", err);
      setError(getFirebaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-frame">
        <div className="auth-brand">
          <img src={realtimeLogo} alt="Realtime Group logo" className="auth-brand__logo" />
          <h1 className="auth-brand__title">Create your workspace account</h1>
          <p className="auth-brand__subtitle">Provision access for chat, meetings, and code collaboration.</p>
        </div>

        <section className="auth-card" aria-label="Sign up form">
          <h2 className="auth-card__heading">Sign up</h2>
          <p className="auth-card__subheading">Start with a standard account and scale with your team.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="auth-label" htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                required
                className="input-control"
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="email">Email (optional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="input-control"
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="phone">Phone (optional)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+123456789"
                className="input-control"
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                required
                className="input-control"
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className="input-control"
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary auth-submit">
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <div className="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <div className="social-btns">
               <button type="button" className="btn-social" onClick={handleGoogleLogin} disabled={loading}>
                  Google
               </button>
               <button type="button" className="btn-social" onClick={() => window.location.href = buildBackendUrl('/api/auth/github')}>
                  GitHub
               </button>
            </div>
          </form>

          <p className="auth-card__footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
