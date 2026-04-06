const ChatService = require('../services/ChatService');
const { z } = require('zod');

const chatMessageSchema = z.object({
    groupId: z.string().min(1),
    content: z.string().min(1).max(5000),
});

module.exports = (io, socket) => {
    socket.on('chat:send', async (payload) => {
        try {
            // Validate payload
            const { groupId, content } = chatMessageSchema.parse(payload);

            const message = await ChatService.sendMessage(
                socket.user.id,
                groupId,
                content,
                socket.user.plan
            );

            // Broadcast to the room
            io.to(`group:${groupId}`).emit('chat:message', message);
        } catch (err) {
            if (err instanceof z.ZodError) {
                return socket.emit('error', { 
                    message: 'Validation failed', 
                    details: err.errors 
                });
            }
            socket.emit('error', { message: err.message });
        }
    });
    socket.on('chat:typing', ({ groupId }) => {
        socket.to(`group:${groupId}`).emit('chat:typing', {
            userId: socket.user.id,
            name: socket.user.name
        });
    });

    socket.on('chat:join', ({ groupId }) => {
        socket.join(`group:${groupId}`);
    });

    socket.on('chat:leave', ({ groupId }) => {
        socket.leave(`group:${groupId}`);
    });
};
