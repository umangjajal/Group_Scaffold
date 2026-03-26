// backend/socket/index.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createCorsOriginValidator } = require('../config/cors');

// Modular Socket Handlers
const registerChatHandlers = require('./chat.socket');
const registerCallHandlers = require('./call.socket');
const registerCollabSocket = require('./collab'); // Keep existing for now

// Shared State
const rtcRooms = new Map(); // roomId -> Map<userId, { socketId, name }>

module.exports = function attachSocket(httpServer, onlineUsers) {
    const io = new Server(httpServer, {
        cors: {
            origin: createCorsOriginValidator(),
            credentials: true
        }
    });

    // Authentication Middleware
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-passwordHash');
            if (!user || user.status === 'suspended') {
                return next(new Error('Authentication error: User not found or suspended.'));
            }
            socket.user = user;
            next();
        } catch (err) {
            console.error("Socket authentication failed:", err.message);
            next(new Error('Authentication error: Invalid token.'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.name} (${socket.user.id})`);
        
        // Track Presence
        onlineUsers.set(socket.user.id.toString(), {
            userId: socket.user.id,
            name: socket.user.name,
            socketId: socket.id,
            connectedAt: new Date(),
        });
        socket.join(`user:${socket.user.id}`);
        io.emit('presence', { userId: socket.user.id, status: 'online' });

        // Register Modular Handlers
        registerChatHandlers(io, socket);
        registerCallHandlers(io, socket, rtcRooms);
        registerCollabSocket(io, socket);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.name}`);
            onlineUsers.delete(socket.user.id.toString());
            io.emit('presence', { userId: socket.user.id, status: 'offline' });
            
            // Cleanup RTC rooms
            for (const [roomId, participants] of rtcRooms.entries()) {
                if (participants.has(socket.user.id.toString())) {
                    participants.delete(socket.user.id.toString());
                    socket.to(`rtc:${roomId}`).emit('rtc:user-left', { 
                        roomId, 
                        userId: socket.user.id.toString() 
                    });
                    if (participants.size === 0) rtcRooms.delete(roomId);
                }
            }
        });
    });

    return io;
};
