const ChatService = require('../services/ChatService');

module.exports = (io, socket) => {
    socket.on('chat:send', async ({ groupId, content }) => {
        try {
            const message = await ChatService.sendMessage(
                socket.user.id,
                groupId,
                content,
                socket.user.plan
            );

            // Broadcast to the room
            io.to(`group:${groupId}`).emit('chat:message', message);
        } catch (err) {
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
