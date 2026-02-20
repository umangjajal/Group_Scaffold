import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!email && !phone) {
      setError('Please provide email or phone');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, { name, email, phone, password });
      saveAuth(res.data);
      navigate('/verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-900 flex items-center justify-center p-4">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-40 right-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Signup Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎬</div>
          <h1 className="text-3xl font-bold text-white mb-2">Join Realtime Group</h1>
          <p className="text-purple-100">Start connecting with others today</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 animate-slideInUp">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create Account ✨</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-slideIn">
              <p className="text-red-700 font-medium text-sm">❌ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone (Optional)
              </label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 text-gray-700 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded mt-1" required />
              <span>
                I agree to the <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">Terms & Conditions</a> and <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">Privacy Policy</a>
              </span>
            </label>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Creating Account...' : 'Sign Up'} 🚀
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with</span>
            </div>
          </div>

          {/* Social Signup */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              className="py-2 px-4 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 font-medium text-gray-700"
            >
              Google 📧
            </button>
            <button
              type="button"
              className="py-2 px-4 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 font-medium text-gray-700"
            >
              GitHub 💻
            </button>
          </div>

          {/* Login Link */}
          <p className="text-center text-gray-700">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline transition"
            >
              Login here
            </Link>
          </p>

          {/* Back to Home */}
          <div className="text-center mt-4">
            <Link
              to="/"
              className="text-sm text-purple-200 hover:text-purple-100 transition"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-purple-100 text-sm mt-6">
          Secure, Fast & Easy. Join thousands of users.
        </p>
      </div>
    </div>
  );
}