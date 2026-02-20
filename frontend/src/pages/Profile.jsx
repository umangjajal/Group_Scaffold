const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendEmailOtp, sendSmsOtp } = require("../services/notify");
const auth = require("../middleware/auth");
const { toUserResponse } = require("../utils/userResponse");

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Validate names
function looksRealName(name) {
  if (!name || name.length < 3) return false;
  if (/\d{2,}/.test(name)) return false;
  if (/[^\p{L}\s.'-]/u.test(name)) return false;
  return true;
}

// ✅ Generate access + refresh tokens
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    plan: user.plan,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

// ================== REGISTER ==================
router.post("/register", async (req, res) => {
  const { email, phone, password, name, gender } = req.body;
  if (!name || !looksRealName(name)) {
    return res.status(400).json({ error: "Invalid name." });
  }
  if (!email && !phone) {
    return res.status(400).json({ error: "Email or phone is required." });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      phone,
      passwordHash,
      name,
      gender: ["male", "female", "other"].includes(gender) ? gender : "other",
      nameVerified: looksRealName(name),
    });
    await newUser.save();

    // ✅ Send OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    if (email) {
      await Otp.create({ channel: "email", value: email, code, expiresAt });
      try {
        await sendEmailOtp(email, code);
      } catch (emailError) {
        console.error("⚠️ OTP email failed but user registered:", emailError.message);
      }
    } else if (phone) {
      await Otp.create({ channel: "phone", value: phone, code, expiresAt });
      try {
        await sendSmsOtp(phone, code);
      } catch (smsError) {
        console.error("⚠️ OTP SMS failed but user registered:", smsError.message);
      }
    }

    const { accessToken, refreshToken } = generateTokens(newUser);
    res.status(201).json({
      message: "User registered. Verify email/phone.",
      user: {
        ...toUserResponse(newUser),
        nameVerified: newUser.nameVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res
      .status(400)
      .json({ error: "Identifier (email/phone) and password are required." });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });
    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials." });

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// ================== REFRESH TOKEN ==================
router.post("/refresh", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Refresh token required." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Token refresh error:", error.message);
    res.status(401).json({ error: "Invalid refresh token." });
  }
});

// ================== GET CURRENT USER ==================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (error) {
    console.error("Get /me error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// ================== UPDATE CURRENT USER ==================
router.put("/me", auth, async (req, res) => {
  const { name, avatarUrl, phone, gender } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (name) user.name = name;
    if (typeof avatarUrl === "string") user.avatarUrl = avatarUrl;
    if (phone) user.phone = phone;
    if (["male", "female", "other"].includes(gender)) user.gender = gender;

    await user.save();

    return res.json({
      message: "Profile updated.",
      user: toUserResponse(user),
    });
  } catch (error) {
    console.error("Update /me error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

// ================== FORGOT PASSWORD (SEND OTP) ==================
router.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account found with this email." });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({ channel: "email", value: email, code, expiresAt, consumed: false });
    await sendEmailOtp(email, code);

    return res.json({ message: "OTP sent to your registered email." });
  } catch (error) {
    console.error("Forgot password send OTP error:", error.message);
    return res.status(500).json({ error: "Failed to send OTP." });
  }
});

// ================== FORGOT PASSWORD (RESET) ==================
router.post("/forgot-password/reset", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Email, OTP code, and new password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account found with this email." });
    }

    const otpRecord = await Otp.findOne({ channel: "email", value: email, code, consumed: false }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid OTP." });
    }
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ error: "OTP expired." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    otpRecord.consumed = true;
    await otpRecord.save();

    return res.json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Forgot password reset error:", error.message);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

module.exports = router;
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AppNavbar from '../components/AppNavbar';
import { AVATAR_PRESETS } from '../constants/avatarPresets';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Profile() {
  const { user, saveAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || 'other');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const joinedOn = useMemo(() => {
    if (!user?.createdAt) return 'Recently joined';
    return new Date(user.createdAt).toLocaleDateString();
  }, [user]);

  const updateProfile = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.put(
        `${API_URL}/api/auth/me`,
        { name, avatarUrl, phone, gender },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      saveAuth({
        user: res.data.user,
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
      });
      setMessage('Profile updated successfully ✨');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const currentPreset = AVATAR_PRESETS[gender] || AVATAR_PRESETS.other;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <AppNavbar />
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white/10 border border-white/20 rounded-2xl p-6 text-white">
          <img
            src={avatarUrl || currentPreset[0]}
            alt="avatar"
            className="w-32 h-32 rounded-full object-cover border-4 border-indigo-400 mx-auto"
          />
          <h2 className="text-center mt-4 text-2xl font-bold">{name || 'User'}</h2>
          <p className="text-center text-indigo-200">{user?.email || 'No email'}</p>
          <div className="mt-6 space-y-2 text-sm">
            <div>🏷️ Role: <span className="font-semibold">{user?.role || 'user'}</span></div>
            <div>💎 Plan: <span className="font-semibold uppercase">{user?.plan || 'free'}</span></div>
            <div>🧬 Gender: <span className="font-semibold capitalize">{gender}</span></div>
            <div>📅 Joined: <span className="font-semibold">{joinedOn}</span></div>
            <div>✅ Email Verified: <span className="font-semibold">{user?.emailVerified ? 'Yes' : 'No'}</span></div>
            <div>📱 Phone Verified: <span className="font-semibold">{user?.phoneVerified ? 'Yes' : 'No'}</span></div>
            <div>🛡️ Status: <span className="font-semibold capitalize">{user?.status || 'active'}</span></div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl shadow-2xl p-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Edit Profile</h3>

          {message && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">{message}</div>}
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => {
                  const nextGender = e.target.value;
                  setGender(nextGender);
                  if (!avatarUrl) {
                    setAvatarUrl((AVATAR_PRESETS[nextGender] || AVATAR_PRESETS.other)[0]);
                  }
                }}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-2">Choose an Avatar</label>
              <div className="grid grid-cols-4 gap-3">
                {currentPreset.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() => setAvatarUrl(avatar)}
                    className={`rounded-full p-1 border-2 ${avatarUrl === avatar ? 'border-indigo-600' : 'border-transparent'} hover:border-indigo-400`}
                    title="Select avatar"
                  >
                    <img src={avatar} alt="avatar preset" className="w-16 h-16 rounded-full" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 9999999999"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 font-medium mb-1">Avatar URL (Optional)</label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              onClick={updateProfile}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}