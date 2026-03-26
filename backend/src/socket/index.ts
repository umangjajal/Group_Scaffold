import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { createCorsOriginValidator } from '../config/cors';
import { 
    ServerToClientEvents, 
    ClientToServerEvents, 
    InterServerEvents, 
    SocketData 
} from '../types/socket.types';

// Mocked for example - these should be converted to TS as well
const registerChatHandlers = require('./chat.socket');
const registerCallHandlers = require('./call.socket');

const rtcRooms = new Map<string, Map<string, { socketId: string; name: string }>>();

export function attachSocket(httpServer: any, onlineUsers: Map<string, any>) {
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

    io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
        const user = socket.data.user;
        if (!user) return;

        console.log(`User connected: ${user.name} (${user.id})`);
        
        onlineUsers.set(user.id.toString(), {
            userId: user.id,
            name: user.name,
            socketId: socket.id,
            connectedAt: new Date(),
        });

        socket.join(`user:${user.id}`);
        io.emit('presence', { userId: user.id.toString(), status: 'online' });

        // Register handlers (these will need TS conversion too)
        registerChatHandlers(io, socket);
        registerCallHandlers(io, socket, rtcRooms);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${user.name}`);
            onlineUsers.delete(user.id.toString());
            io.emit('presence', { userId: user.id.toString(), status: 'offline' });
        });
    });

    return io;
}
