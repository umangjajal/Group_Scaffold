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
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-600 mb-6">Reset your password using OTP sent to your registered email.</p>

        {message && <div className="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-700">{message}</div>}
        {error && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{error}</div>}

        {step === 1 ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registered Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button disabled={loading} className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OTP Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button disabled={loading} className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-center text-gray-600">Remembered password? <Link to="/login" className="text-indigo-600 font-semibold">Back to Login</Link></p>
      </div>
    </div>
  );
}
