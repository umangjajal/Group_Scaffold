import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { createCorsOriginValidator } from '../config/cors';
import { pubClient, subClient } from '../config/redis';
import PresenceService from '../services/PresenceService';
import { 
    ServerToClientEvents, 
    ClientToServerEvents, 
    InterServerEvents, 
    OnlineUser,
    SocketData 
} from '../types/socket.types';

// Mocked for example - these should be converted to TS as well
const registerChatHandlers = require('./chat.socket');
const registerCallHandlers = require('./call.socket');

// rtcRooms is now managed by RTCService in Redis
export function attachSocket(httpServer: HttpServer, onlineUsers: Map<string, OnlineUser>) {
    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
        cors: {
            origin: createCorsOriginValidator(),
            credentials: true
        }
    });

    // Enable Redis Adapter for Horizontal Scaling
    if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('🚀 Socket.io Redis Adapter Enabled');
    }

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
            const user = await User.findById(decoded.id);
            if (!user || user.status === 'suspended') {
                return next(new Error('Authentication error: User not found or suspended.'));
            }
            socket.data.user = user;
            next();
        } catch (err) {
            console.error("Socket authentication failed:", (err as Error).message);
            next(new Error('Authentication error: Invalid token.'));
        }
    });

    io.on('connection', async (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
        const user = socket.data.user;
        if (!user) return;

        const userId = user.id.toString();
        console.log(`User connected: ${user.name} (${userId})`);
        
        const userData = {
            userId: userId,
            name: user.name,
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
        };

        // Track globally in Redis
        await PresenceService.setUserOnline(userId, userData);

        // Keep local Map for backward compatibility if needed, though discouraged in production
        onlineUsers.set(userId, userData);

        socket.join(`user:${userId}`);
        io.emit('presence', { userId: userId, status: 'online' });

        // Register handlers
        registerChatHandlers(io, socket);
        registerCallHandlers(io, socket);

        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${user.name}`);
            
            await PresenceService.setUserOffline(userId);
            onlineUsers.delete(userId);

            io.emit('presence', { userId: userId, status: 'offline' });
        });
    });

    return io;
}
