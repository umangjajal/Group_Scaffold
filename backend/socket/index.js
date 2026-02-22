// backend/socket/index.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Quota = require('../models/QuotaUsage'); // For message quota
const Plans = require('../models/Plan');
const User = require('../models/User');
const { createCorsOriginValidator } = require('../config/cors');
const registerCollabSocket = require('./collab');
const registerTerminalSocket = require('./terminal');

// New models for calling features
const CallQuota = require('../models/CallQuota');
const CallSession = require('../models/CallSession');
const RandomMatch = require('../models/RandomMatch'); // If you want to log random matches

// In-memory store for random matching queue (simple FIFO)
const randomMatchQueue = {
    audio: [], // { userId, socketId, filters }
    video: []
};

// In-memory room collaboration stores
const meetingParticipants = new Map(); // groupId -> Map<userId, { socketId, name }>
const groupTasks = new Map(); // groupId -> Task[]
const rtcRooms = new Map(); // roomId -> Map<userId, { socketId, name }>

// Helper to get current day key for quotas
function dayKey() { return new Date().toISOString().slice(0, 10); }

module.exports = function attachSocket(httpServer, onlineUsers) {
    const io = new Server(httpServer, {
        cors: {
            origin: createCorsOriginValidator(),
            credentials: true
        }
    });


    if (String(process.env.SOCKET_REDIS_ENABLED || 'false') === 'true') {
        console.log('ℹ️ SOCKET_REDIS_ENABLED=true. Install @socket.io/redis-adapter + redis and wire adapter for horizontal scaling.');
    }

    // Socket.IO middleware for authentication
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Fetch full user object to ensure it's active and get latest plan
            const user = await User.findById(decoded.id).select('-passwordHash');
            if (!user || user.status === 'suspended') {
                return next(new Error('Authentication error: User not found or suspended.'));
            }
            socket.user = user; // Attach full user object to socket
            next();
        } catch (err) {
            console.error("Socket authentication failed:", err.message);
            next(new Error('Authentication error: Invalid token.'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.name} (${socket.user.id})`);
        
        // Track user as online
        onlineUsers.set(socket.user.id.toString(), {
            userId: socket.user.id,
            name: socket.user.name,
            email: socket.user.email,
            socketId: socket.id,
            connectedAt: new Date(),
            lastSeen: new Date()
        });

        // Join a private room for the user's ID to send direct notifications
        socket.join(`user:${socket.user.id}`);

        // Emit presence status (e.g., 'online')
        io.emit('presence', { userId: socket.user.id, status: 'online' });

        const joinedRtcRooms = new Set();

        const leaveRtcRoom = (roomId) => {
            const normalizedRoomId = String(roomId || '');
            if (!normalizedRoomId) return;

            const roomParticipants = rtcRooms.get(normalizedRoomId);
            if (!roomParticipants) return;

            roomParticipants.delete(socket.user.id.toString());
            socket.leave(`rtc:${normalizedRoomId}`);
            joinedRtcRooms.delete(normalizedRoomId);

            socket.to(`rtc:${normalizedRoomId}`).emit('rtc:user-left', { roomId: normalizedRoomId, userId: socket.user.id.toString() });

            if (roomParticipants.size === 0) {
                rtcRooms.delete(normalizedRoomId);
            }
        };

        // --- Room WebRTC (multi-user mesh for video collaboration) ---
        socket.on('rtc:join-room', ({ roomId }) => {
            const normalizedRoomId = String(roomId || '');
            if (!normalizedRoomId) return;

            if (!rtcRooms.has(normalizedRoomId)) {
                rtcRooms.set(normalizedRoomId, new Map());
            }

            const roomParticipants = rtcRooms.get(normalizedRoomId);
            const existingParticipants = Array.from(roomParticipants.values());

            roomParticipants.set(socket.user.id.toString(), {
                userId: socket.user.id.toString(),
                name: socket.user.name,
                socketId: socket.id,
            });

            joinedRtcRooms.add(normalizedRoomId);
            socket.join(`rtc:${normalizedRoomId}`);

            socket.emit('rtc:participants', {
                roomId: normalizedRoomId,
                participants: existingParticipants,
            });

            socket.to(`rtc:${normalizedRoomId}`).emit('rtc:user-joined', {
                roomId: normalizedRoomId,
                participant: {
                    userId: socket.user.id.toString(),
                    name: socket.user.name,
                },
            });
        });

        socket.on('rtc:leave-room', ({ roomId }) => {
            leaveRtcRoom(roomId);
        });

        socket.on('rtc:offer', ({ to, sdp, roomId }) => {
            io.to(`user:${to}`).emit('rtc:offer', {
                from: socket.user.id.toString(),
                fromName: socket.user.name,
                roomId,
                sdp,
            });
        });

        socket.on('rtc:answer', ({ to, sdp, roomId }) => {
            io.to(`user:${to}`).emit('rtc:answer', {
                from: socket.user.id.toString(),
                roomId,
                sdp,
            });
        });

        socket.on('rtc:candidate', ({ to, candidate, roomId }) => {
            io.to(`user:${to}`).emit('rtc:candidate', {
                from: socket.user.id.toString(),
                roomId,
                candidate,
            });
        });

        // --- Group Chat Events (from previous implementation) ---
        registerCollabSocket(io, socket);
        registerTerminalSocket(io, socket);

        socket.on('join', ({ groupId }) => {
            socket.join(`group:${groupId}`);
            console.log(`${socket.user.name} joined group:${groupId}`);
            io.to(`group:${groupId}`).emit('presence', { userId: socket.user.id, status: 'online', groupId });
        });

        socket.on('leave', ({ groupId }) => {
            socket.leave(`group:${groupId}`);
            console.log(`${socket.user.name} left group:${groupId}`);
            io.to(`group:${groupId}`).emit('presence', { userId: socket.user.id, status: 'offline', groupId });
        });

        // --- Meeting events (multi-party WebRTC mesh signaling) ---
        socket.on('meeting:join', ({ groupId }) => {
            if (!groupId) return;

            socket.join(`meeting:${groupId}`);

            const key = String(groupId);
            const participantsForRoom = meetingParticipants.get(key) || new Map();
            const existingParticipants = Array.from(participantsForRoom.entries()).map(([id, participant]) => ({
                id,
                name: participant.name,
            }));

            participantsForRoom.set(socket.user.id.toString(), {
                socketId: socket.id,
                name: socket.user.name,
            });
            meetingParticipants.set(key, participantsForRoom);

            socket.emit('meeting:participants', { groupId, participants: existingParticipants });
            socket.to(`meeting:${groupId}`).emit('meeting:peer-joined', {
                groupId,
                peer: { id: socket.user.id, name: socket.user.name },
            });
        });

        socket.on('meeting:signal', ({ groupId, to, signal }) => {
            if (!groupId || !to || !signal) return;
            io.to(`user:${to}`).emit('meeting:signal', {
                groupId,
                from: socket.user.id,
                signal,
            });
        });

        socket.on('meeting:leave', ({ groupId }) => {
            if (!groupId) return;
            socket.leave(`meeting:${groupId}`);
            const key = String(groupId);
            const participantsForRoom = meetingParticipants.get(key);
            if (!participantsForRoom) return;

            participantsForRoom.delete(socket.user.id.toString());
            if (participantsForRoom.size === 0) {
                meetingParticipants.delete(key);
                groupTasks.delete(key);
            } else {
                meetingParticipants.set(key, participantsForRoom);
            }

            socket.to(`meeting:${groupId}`).emit('meeting:peer-left', {
                groupId,
                peerId: socket.user.id,
            });
        });

        // --- Task management events (real-time Kanban-lite) ---
        socket.on('task:list', ({ groupId }) => {
            if (!groupId) return;
            const tasks = groupTasks.get(String(groupId)) || [];
            socket.emit('task:list', { groupId, tasks });
        });

        socket.on('task:create', ({ groupId, title }) => {
            if (!groupId || !String(title || '').trim()) return;
            const key = String(groupId);
            const tasks = groupTasks.get(key) || [];
            const task = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                title: String(title).trim(),
                completed: false,
                version: 1,
                updatedAt: new Date().toISOString(),
                createdBy: {
                    id: socket.user.id,
                    name: socket.user.name,
                },
            };
            tasks.unshift(task);
            groupTasks.set(key, tasks);
            io.to(`group:${groupId}`).emit('task:upsert', { groupId, task });
        });

        socket.on('task:toggle', ({ groupId, taskId, completed }) => {
            if (!groupId || !taskId) return;
            const key = String(groupId);
            const tasks = groupTasks.get(key) || [];
            const index = tasks.findIndex((task) => task.id === taskId);
            if (index === -1) return;

            tasks[index] = {
                ...tasks[index],
                completed: Boolean(completed),
                version: (tasks[index].version || 1) + 1,
                updatedAt: new Date().toISOString(),
            };
            groupTasks.set(key, tasks);
            io.to(`group:${groupId}`).emit('task:upsert', { groupId, task: tasks[index] });
        });

        socket.on('task:delete', ({ groupId, taskId }) => {
            if (!groupId || !taskId) return;
            const key = String(groupId);
            const tasks = groupTasks.get(key) || [];
            const nextTasks = tasks.filter((task) => task.id !== taskId);
            groupTasks.set(key, nextTasks);
            io.to(`group:${groupId}`).emit('task:delete', { groupId, taskId });
        });

        socket.on('message:send', async ({ groupId, text, mediaUrl }) => {
            try {
                const plan = Plans[socket.user.plan];
                if (!plan) {
                    console.warn(`User ${socket.user.id} has invalid plan: ${socket.user.plan}`);
                    return;
                }

                const d = dayKey();
                const q = await Quota.findOneAndUpdate(
                    { user: socket.user.id, date: d },
                    { $setOnInsert: { messagesSent: 0 } },
                    { new: true, upsert: true }
                );

                if (q.messagesSent >= plan.dailyMessages) {
                    console.log(`User ${socket.user.name} exceeded daily message quota.`);
                    socket.emit('error', { message: 'Daily message quota exceeded.' });
                    return;
                }

                const isMember = await require('../models/Membership').exists({ user: socket.user.id, group: groupId });
                if (!isMember) {
                    console.warn(`User ${socket.user.name} tried to send message to group ${groupId} without being a member.`);
                    socket.emit('error', { message: 'You are not a member of this group.' });
                    return;
                }

                const msg = await Message.create({
                    group: groupId,
                    sender: socket.user.id,
                    text,
                    mediaUrl
                });

                await Quota.updateOne({ _id: q._id }, { $inc: { messagesSent: 1 } });

                io.to(`group:${groupId}`).emit('message:new', {
                    ...msg.toObject(),
                    sender: {
                        id: socket.user.id,
                        name: socket.user.name,
                        avatarUrl: socket.user.avatarUrl
                    }
                });
                console.log(`Message sent to group ${groupId} by ${socket.user.name}`);

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message.' });
            }
        });

        socket.on('typing', ({ groupId, isTyping }) => {
            socket.to(`group:${groupId}`).emit('typing', { userId: socket.user.id, groupId, isTyping });
        });

        socket.on('read', async ({ groupId, messageIds }) => {
            try {
                await Message.updateMany(
                    { _id: { $in: messageIds }, group: groupId, 'readBy': { $ne: socket.user.id } },
                    { $addToSet: { readBy: socket.user.id } }
                );
                io.to(`group:${groupId}`).emit('read', { messageIds, by: socket.user.id });
            } catch (error) {
                console.error('Error marking messages as read:', error);
            }
        });

        // --- Voice & Video Calling Events ---

        // Helper to check call quota
        const checkCallQuota = async (userId, callType, durationSeconds) => {
            const userPlan = Plans[socket.user.plan];
            if (!userPlan) return false; // Invalid plan

            const d = dayKey();
            const userCallQuota = await CallQuota.findOneAndUpdate(
                { user: userId, date: d },
                { $setOnInsert: { voiceSeconds: 0, videoSeconds: 0 } },
                { new: true, upsert: true }
            );

            if (callType === 'audio') {
                return (userCallQuota.voiceSeconds + durationSeconds) <= userPlan.voiceMinutesPerDay * 60;
            } else if (callType === 'video') {
                return (userCallQuota.videoSeconds + durationSeconds) <= userPlan.videoMinutesPerDay * 60;
            }
            return false;
        };

        // Helper to increment call quota
        const incrementCallQuota = async (userId, callType, durationSeconds) => {
            const d = dayKey();
            const updateField = callType === 'audio' ? 'voiceSeconds' : 'videoSeconds';
            await CallQuota.findOneAndUpdate(
                { user: userId, date: d },
                { $inc: { [updateField]: durationSeconds } },
                { upsert: true }
            );
        };

        // Client -> Server: Request a call or random match
        socket.on('call:request', async ({ toUserId, type = 'audio', isAnonymous = false, filters = {} }) => {
            const fromUser = socket.user;
            const toUser = toUserId ? await User.findById(toUserId) : null;

            if (toUserId && !toUser) {
                return socket.emit('error', { message: 'Target user not found.' });
            }

            // Check if 'fromUser' can initiate this call type based on plan
            const fromUserPlan = Plans[fromUser.plan];
            if (!fromUserPlan || (type === 'video' && fromUserPlan.videoMinutesPerDay === 0)) {
                return socket.emit('error', { message: `Your plan does not support ${type} calls.` });
            }

            // Create a new CallSession
            const newCallSession = await CallSession.create({
                participants: [fromUser._id, toUser ? toUser._id : null].filter(Boolean),
                type,
                isAnonymous,
                startedAt: new Date(),
                status: 'ringing',
                metadata: {
                    callerName: fromUser.name,
                    callerAvatar: fromUser.avatarUrl,
                    filters // For random calls
                }
            });

            // Join the call session room
            socket.join(`call:${newCallSession._id}`);

            if (toUser) { // Direct call
                // Send a ring to target user
                io.to(`user:${toUser._id}`).emit('call:ring', {
                    fromUser: {
                        id: fromUser._id,
                        name: isAnonymous ? 'Anonymous' : fromUser.name,
                        avatarUrl: isAnonymous ? null : fromUser.avatarUrl
                    },
                    sessionId: newCallSession._id,
                    type,
                    preview: {
                        name: isAnonymous ? 'Anonymous' : fromUser.name,
                        avatarUrl: isAnonymous ? null : fromUser.avatarUrl,
                        plan: fromUser.plan // Can be used for UI hints
                    }
                });
                console.log(`Call request from ${fromUser.name} to ${toUser.name} (Session: ${newCallSession._id})`);
            } else { // Random matching
                // Add caller to the queue
                randomMatchQueue[type].push({
                    userId: fromUser._id,
                    socketId: socket.id,
                    sessionId: newCallSession._id,
                    filters,
                    plan: fromUser.plan,
                    isAnonymous
                });
                console.log(`User ${fromUser.name} joined random ${type} queue.`);
                socket.emit('random:waiting', { sessionId: newCallSession._id, type });

                // Attempt to match
                attemptRandomMatch(type).catch((error) => {
                    console.error('Random match attempt failed:', error.message);
                    socket.emit('error', { message: 'Random matching failed. Please retry.' });
                });
            }
        });

        // WebRTC Signaling: Offer
        socket.on('call:offer', ({ to, sdp, sessionId }) => {
            io.to(`user:${to}`).emit('call:offer', { from: socket.user.id, sdp, sessionId });
        });

        // WebRTC Signaling: Answer
        socket.on('call:answer', ({ to, sdp, sessionId }) => {
            io.to(`user:${to}`).emit('call:answer', { from: socket.user.id, sdp, sessionId });
        });

        // WebRTC Signaling: ICE Candidate
        socket.on('call:candidate', ({ to, candidate, sessionId }) => {
            io.to(`user:${to}`).emit('call:candidate', { from: socket.user.id, candidate, sessionId });
        });

        // Client -> Server: Accept a call
        socket.on('call:accept', async ({ sessionId }) => {
            try {
                const callSession = await CallSession.findById(sessionId);
                if (!callSession) {
                    return socket.emit('error', { message: 'Call session not found.' });
                }
                if (callSession.status !== 'ringing') {
                    return socket.emit('error', { message: 'Call already accepted or ended.' });
                }

                // Add current user to participants if not already there
                if (!callSession.participants.includes(socket.user._id)) {
                    callSession.participants.push(socket.user._id);
                }
                callSession.status = 'active';
                callSession.startedAt = new Date(); // Re-set startedAt to actual acceptance time
                await callSession.save();

                // Join the call session room
                socket.join(`call:${sessionId}`);

                // Notify all participants (including self) that call is active
                callSession.participants.forEach(pId => {
                    io.to(`user:${pId}`).emit('call:active', { sessionId, participants: callSession.participants });
                });
                console.log(`Call session ${sessionId} accepted by ${socket.user.name}`);

            } catch (error) {
                console.error('Error accepting call:', error);
                socket.emit('error', { message: 'Failed to accept call.' });
            }
        });

        // Client -> Server: Reject/End a call
        socket.on('call:end', async ({ sessionId, reason = 'ended' }) => {
            try {
                const callSession = await CallSession.findById(sessionId);
                if (!callSession) {
                    return socket.emit('error', { message: 'Call session not found.' });
                }

                if (callSession.status === 'ended' || callSession.status === 'failed') {
                    return; // Already ended
                }

                callSession.endedAt = new Date();
                callSession.status = 'ended';
                callSession.durationSec = Math.floor((callSession.endedAt.getTime() - callSession.startedAt.getTime()) / 1000);
                await callSession.save();

                // Increment call quota for all participants
                for (const participantId of callSession.participants) {
                    await incrementCallQuota(participantId, callSession.type, callSession.durationSec);
                }

                // Notify all participants in the call room
                io.to(`call:${sessionId}`).emit('call:ended', { sessionId, reason, duration: callSession.durationSec });
                console.log(`Call session ${sessionId} ended by ${socket.user.name} (Reason: ${reason}, Duration: ${callSession.durationSec}s)`);

                // Leave the call session room
                socket.leave(`call:${sessionId}`);

            } catch (error) {
                console.error('Error ending call:', error);
                socket.emit('error', { message: 'Failed to end call.' });
            }
        });

        // Client -> Server: Join random matching pool
        socket.on('random:join', ({ type = 'audio', filters = {} }) => {
            const userPlan = Plans[socket.user.plan];
            if (!userPlan || (type === 'video' && userPlan.videoMinutesPerDay === 0)) {
                return socket.emit('error', { message: `Your plan does not support random ${type} calls.` });
            }

            // Check if user is already in a queue
            const isInQueue = randomMatchQueue[type].some(entry => entry.userId.toString() === socket.user.id.toString());
            if (isInQueue) {
                return socket.emit('error', { message: 'You are already in the random matching queue.' });
            }

            randomMatchQueue[type].push({
                userId: socket.user._id,
                socketId: socket.id,
                filters,
                plan: socket.user.plan,
                isAnonymous: true // Random calls are anonymous by default
            });
            console.log(`User ${socket.user.name} joined random ${type} queue.`);
            socket.emit('random:waiting', { type });

            attemptRandomMatch(type).catch((error) => {
                console.error('Random match attempt failed:', error.message);
                socket.emit('error', { message: 'Random matching failed. Please retry.' });
            });
        });

        // Client -> Server: Leave random matching pool
        socket.on('random:leave', ({ type = 'audio' }) => {
            const initialLength = randomMatchQueue[type].length;
            randomMatchQueue[type] = randomMatchQueue[type].filter(entry => entry.userId.toString() !== socket.user.id.toString());
            if (randomMatchQueue[type].length < initialLength) {
                console.log(`User ${socket.user.name} left random ${type} queue.`);
                socket.emit('random:left', { type });
            }
        });

        // --- Random Matching Logic ---
        async function attemptRandomMatch(type) {
            if (randomMatchQueue[type].length < 2) {
                return; // Not enough users for a match
            }

            // Simple FIFO matching for demo
            const user1Entry = randomMatchQueue[type].shift();
            const user2Entry = randomMatchQueue[type].shift();

            const user1Socket = io.sockets.sockets.get(user1Entry.socketId);
            const user2Socket = io.sockets.sockets.get(user2Entry.socketId);

            if (!user1Socket || !user2Socket) {
                // One of the users disconnected, put the other back in queue
                if (user1Socket) randomMatchQueue[type].unshift(user1Entry);
                if (user2Socket) randomMatchQueue[type].unshift(user2Entry);
                return;
            }

            const user1 = user1Socket.user;
            const user2 = user2Socket.user;

            // Create a new CallSession for the random match
            const newCallSession = await CallSession.create({
                participants: [user1._id, user2._id],
                type,
                mode: 'p2p', // Default for random, can be SFU based on plan
                isAnonymous: true,
                startedAt: new Date(),
                status: 'active', // Immediately active for random match
                metadata: {
                    randomMatch: true,
                    filters: { user1: user1Entry.filters, user2: user2Entry.filters }
                }
            });

            // Log the random match (optional)
            await RandomMatch.create({
                userA: user1._id,
                userB: user2._id,
                filters: { userA: user1Entry.filters, userB: user2Entry.filters },
                createdAt: new Date(),
                acceptedAt: new Date() // Immediately accepted
            });

            // Both users join the call session room
            user1Socket.join(`call:${newCallSession._id}`);
            user2Socket.join(`call:${newCallSession._id}`);

            // Notify both users they found a match
            user1Socket.emit('random:found', {
                sessionId: newCallSession._id,
                otherUserPreview: {
                    id: user2._id,
                    name: 'Anonymous', // Always anonymous for random
                    avatarUrl: null,
                    plan: user2.plan
                }
            });
            user2Socket.emit('random:found', {
                sessionId: newCallSession._id,
                otherUserPreview: {
                    id: user1._id,
                    name: 'Anonymous',
                    avatarUrl: null,
                    plan: user1.plan
                }
            });
            console.log(`Random ${type} match found: ${user1.name} and ${user2.name} (Session: ${newCallSession._id})`);
        }

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.name} (${socket.user.id})`);

            for (const roomId of joinedRtcRooms) {
                leaveRtcRoom(roomId);
            }

            // Remove user from online tracking
            onlineUsers.delete(socket.user.id.toString());

            io.emit('presence', { userId: socket.user.id, status: 'offline' });

            // Remove user from any random matching queues
            for (const type of ['audio', 'video']) {
                randomMatchQueue[type] = randomMatchQueue[type].filter(entry => entry.socketId !== socket.id);
            }

            // Remove user from meeting participant maps and notify peers
            for (const [groupId, participantsForRoom] of meetingParticipants.entries()) {
                const hadParticipant = participantsForRoom.delete(socket.user.id.toString());
                if (!hadParticipant) continue;

                if (participantsForRoom.size === 0) {
                    meetingParticipants.delete(groupId);
                    groupTasks.delete(groupId);
                } else {
                    meetingParticipants.set(groupId, participantsForRoom);
                }

                socket.to(`meeting:${groupId}`).emit('meeting:peer-left', {
                    groupId,
                    peerId: socket.user.id,
                });
            }
        });
    });

    return io;
};
