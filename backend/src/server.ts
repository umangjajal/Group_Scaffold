import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import { createCorsOriginValidator } from './config/cors';
import { errorHandler } from './middleware/errorHandler';
import { attachSocket } from './socket';
import type { OnlineUser } from './types/socket.types';
import logger from './utils/logger';

// Import routes
// Note: These will need to be converted to TS as well, but for now we'll import as we migrate.
const authRoutes = require('../routes/auth');
const groupsRoutes = require('../routes/groups');

const app = express();
const server = http.createServer(app);

// ---------------------------------
// # MIDDLEWARE CONFIGURATION
// ---------------------------------

// Structured Logging
app.use(pinoHttp({ logger }));

// Security Headers
app.use(helmet());

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Parse JSON request body
app.use(express.json({ limit: '5mb' }));

// CORS config
app.use(
  cors({
    origin: createCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// ---------------------------------
// # DATABASE CONNECTION
// ---------------------------------
mongoose
  .connect(process.env.MONGO_URL as string)
  .then(() => logger.info('✅ MongoDB connected successfully.'))
  .catch((err) => {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------------------------------
// # API ROUTES
// ---------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const onlineUsers = new Map<string, any>();

attachSocket(server, onlineUsers);

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
