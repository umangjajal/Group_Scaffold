import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password/send-otp`, { email });
      setMessage(res.data.message || 'OTP sent successfully');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password/reset`, {
        email,
        code,
        newPassword,
      });
      setMessage(res.data.message || 'Password reset successful');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-frame">
        <div className="auth-brand">
          <img src="/realtime-logo.svg" alt="Realtime Group logo" className="auth-brand__logo" />
          <h1 className="auth-brand__title">Reset password</h1>
          <p className="auth-brand__subtitle">Recover account access with a one-time code.</p>
        </div>

        <section className="auth-card glass-panel" aria-label="Forgot password form">
          <h2 className="auth-card__heading">Forgot Password</h2>
          <p className="auth-card__subheading">We will send an OTP to your registered email address.</p>

          {message && <div className="dashboard-alert dashboard-alert--success" style={{ marginTop: '0.8rem', marginBottom: 0 }}>{message}</div>}
          {error && <div className="dashboard-alert dashboard-alert--error" style={{ marginTop: '0.8rem', marginBottom: 0 }}>{error}</div>}

          {step === 1 ? (
            <form onSubmit={sendOtp} className="auth-form">
              <div>
                <label className="auth-label" htmlFor="email">Registered Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-control"
                />
              </div>
              <button disabled={loading} className="btn btn--primary auth-submit">
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="auth-form">
              <div>
                <label className="auth-label" htmlFor="otp">OTP Code</label>
                <input
                  id="otp"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={6}
                  className="input-control code-font"
                />
              </div>
              <div>
                <label className="auth-label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="input-control"
                />
              </div>
              <button disabled={loading} className="btn btn--primary auth-submit">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="auth-card__footer">
            Remembered your password? <Link to="/login">Back to Login</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
