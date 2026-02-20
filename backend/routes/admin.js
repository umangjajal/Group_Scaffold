// backend/routes/admin.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');
const Group = require('../models/group');
const Message = require('../models/Message');
const Membership = require('../models/Membership');
const Plans = require('../models/Plan');

// Simple in-memory store for online users (in production, use Redis)
const onlineUsers = new Map();

// Admin login endpoint (no auth required)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful.',
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken: token,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Middleware to ensure user is an admin
const isAdmin = requireRole('admin');

// GET /api/admin/users - List all users with online status
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-passwordHash');
    
    // Add online status
    const usersWithStatus = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isOnline: onlineUsers.has(u._id.toString()),
      lastSeen: onlineUsers.get(u._id.toString())?.lastSeen || u.updatedAt,
      plan: u.plan,
      status: u.status,
      createdAt: u.createdAt,
    }));

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error fetching users (admin):', error);
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const onlineCount = onlineUsers.size;
    const totalGroups = await Group.countDocuments();
    const totalMessages = await Message.countDocuments();

    res.json({
      totalUsers,
      onlineUsers: onlineCount,
      offlineUsers: totalUsers - onlineCount,
      totalGroups,
      totalMessages,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/admin/users/:id - Update user status/role/plan
router.patch('/users/:id', auth, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const { status, role, plan } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (status && ['active', 'suspended'].includes(status)) {
      user.status = status;
    }
    if (role && ['user', 'admin'].includes(role)) {
      user.role = role;
    }
    if (plan && Plans[plan]) {
      user.plan = plan;
    }

    await user.save();
    res.json({ message: 'User updated successfully.', user });
  } catch (error) {
    console.error('Error updating user (admin):', error);
    res.status(500).json({ error: 'Server error updating user.' });
    }
});

// DELETE /api/admin/messages/:id - Delete a message (protected, admin only)
router.delete('/messages/:id', auth, isAdmin, async (req, res) => {
    const messageId = req.params.id;

    try {
        const message = await Message.findByIdAndDelete(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found.' });
        }
        res.json({ message: 'Message deleted successfully.' });
    } catch (error) {
        console.error('Error deleting message (admin):', error);
        res.status(500).json({ error: 'Server error deleting message.' });
    }
});

// POST /api/admin/broadcast - Send a global announcement (protected, admin only, VIIP policy)
router.post('/broadcast', auth, isAdmin, async (req, res) => {
    const { title, body } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required for announcement.' });
    }

    // As per policy, admin broadcast is for VIIP only.
    // This check is more about who can initiate it, not who receives it.
    // The actual Socket.IO broadcast will send to all connected clients.
    if (req.user.plan !== 'viip') {
        return res.status(403).json({ error: 'Only VIIP plan admins can send global announcements.' });
    }

    try {
        // In a real app, you might save this announcement to a DB
        // and then emit it via Socket.IO to all connected clients.
        // For now, we'll just acknowledge it.
        // The actual Socket.IO emission will be handled in the socket server.
        res.json({ message: 'Global announcement initiated.', announcement: { title, body } });
    } catch (error) {
        console.error('Error sending broadcast (admin):', error);
        res.status(500).json({ error: 'Server error sending broadcast.' });
    }
});

module.exports = { router, onlineUsers };