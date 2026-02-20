// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const attachSocket = require('./socket');

// Import routes
const authRoutes = require('./routes/auth');
const verifyRoutes = require('./routes/verify');
const groupsRoutes = require('./routes/groups');
const { router: adminRoutes, onlineUsers } = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// ---------------------------------
// # MIDDLEWARE CONFIGURATION
// ---------------------------------

// Parse JSON request body
app.use(express.json({ limit: '5mb' }));

// CORS config
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Basic security headers
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ---------------------------------
// # DATABASE CONNECTION
// ---------------------------------
const User = require('./models/User');
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ MongoDB connected successfully.');
  
  // Create default admin user if it doesn't exist
  try {
    const adminEmail = 'admin@realtime-group.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin@123456', 10);
      const adminUser = await User.create({
        email: adminEmail,
        name: 'Admin',
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active'
      });
      console.log('✅ Default admin user created. Email: admin@realtime-group.com, Password: admin@123456');
    }
  } catch (err) {
    console.error('Error creating default admin user:', err);
  }
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ---------------------------------
// # API ROUTES
// ---------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes); // ✅ OTP verification routes
app.use('/api/groups', groupsRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------
// # SOCKET.IO SETUP
// ---------------------------------
attachSocket(server, onlineUsers);

// ---------------------------------
// # SERVER START
// ---------------------------------
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📝 API Docs: http://localhost:${PORT}/health`);
});

// Crash safety
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
