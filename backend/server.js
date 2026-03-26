require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const attachSocket = require('./socket');
const { createCorsOriginValidator, parseAllowedOrigins } = require('./config/cors');

// Import Gemini logic
const { chatWithGemini } = require('./gemini'); 

// Import routes
const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const collabRoutes = require('./routes/collab');
const uploadRoutes = require('./routes/upload');
const verifyRoutes = require('./routes/verify');
const { router: adminRoutes, onlineUsers } = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

function hasFrontendBuild() {
  return fs.existsSync(frontendIndexPath);
}

// Passport Config
const passport = require('passport');
require('./config/passport')(passport);
app.use(passport.initialize());

// ---------------------------------
// # MIDDLEWARE CONFIGURATION
// ---------------------------------

// Parse JSON request body
app.use(express.json({ limit: '5mb' }));

// CORS config
app.use(cors({
  origin: createCorsOriginValidator(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.options('*', cors({ origin: createCorsOriginValidator(), credentials: true }));

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
      await User.create({
        email: adminEmail,
        name: 'Admin',
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active'
      });
      console.log('✅ Default admin user created.');
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

// New AI Route for Gemini
app.post('/api/ai/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const aiResponse = await chatWithGemini(prompt);
    res.json({ response: aiResponse });
  } catch (error) {
    if (error.code === 'GEMINI_UNAVAILABLE') {
      return res.status(503).json({ error: error.message });
    }

    console.error('Failed to get AI response:', error);
    res.status(502).json({ error: 'Failed to get AI response' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, 'workspace_files/uploads')));

app.use(express.static(frontendDistPath, { index: false }));

app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)|socket\.io(?:\/|$)).*/, (req, res, next) => {
  if (!hasFrontendBuild()) {
    return next();
  }

  return res.sendFile(frontendIndexPath);
});

// 404 handler
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
  console.log(`🌐 Allowed CORS origins: ${parseAllowedOrigins().join(', ')}`);
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
