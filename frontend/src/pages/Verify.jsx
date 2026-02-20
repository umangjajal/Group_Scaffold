import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Verify() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channel, setChannel] = useState(user?.email ? 'email' : 'phone');
  const [value, setValue] = useState(user?.email || user?.phone || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🔹 Send OTP
  const requestOtp = async () => {
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/verify/send-otp`,
        { channel, value },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      setMessage(response.data.message || `OTP sent to your ${channel}`);
    } catch (err) {
      let errorMsg = 'Failed to send OTP. Please try again.';
      if (err.response) errorMsg = err.response.data?.error || errorMsg;
      else if (err.request) errorMsg = 'Server not responding. Please check your connection.';
      else errorMsg = err.message || errorMsg;

      setError(errorMsg);
      console.error('OTP request error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Verify OTP
  const confirmOtp = async () => {
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/verify/verify-otp`,
        { channel, value, code },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      setMessage(response.data.message || `${channel} verified successfully!`);
      setTimeout(() => navigate('/groups'), 1500);
    } catch (err) {
      let errorMsg = 'Invalid OTP. Please try again.';
      if (err.response) errorMsg = err.response.data?.error || errorMsg;
      else if (err.request) errorMsg = 'Server not responding. Please check your connection.';
      else errorMsg = err.message || errorMsg;

      setError(errorMsg);
      console.error('OTP confirmation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Verify {channel}</h2>

      {/* Method Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Verification Method:</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="w-full p-2 border rounded-md"
        >
          {user?.email && <option value="email">Email</option>}
          {user?.phone && <option value="phone">Phone</option>}
        </select>
      </div>

      {/* Input for Email/Phone */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Your {channel}:</label>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Your ${channel}`}
            className="flex-1 p-2 border rounded-md"
          />
          <button
            onClick={requestOtp}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoading ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      </div>

      {/* OTP Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Enter OTP Code:</label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            className="flex-1 p-2 border rounded-md"
          />
          <button
            onClick={confirmOtp}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
    </div>
  );
}
