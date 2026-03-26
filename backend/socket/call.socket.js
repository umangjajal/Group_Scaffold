module.exports = (io, socket, rtcRooms) => {
    const leaveRtcRoom = (roomId) => {
        const normalizedRoomId = String(roomId || '');
        if (!normalizedRoomId) return;

        const roomParticipants = rtcRooms.get(normalizedRoomId);
        if (!roomParticipants) return;

        roomParticipants.delete(socket.user.id.toString());
        socket.leave(`rtc:${normalizedRoomId}`);

        socket.to(`rtc:${normalizedRoomId}`).emit('rtc:user-left', { 
            roomId: normalizedRoomId, 
            userId: socket.user.id.toString() 
        });

        if (roomParticipants.size === 0) {
            rtcRooms.delete(normalizedRoomId);
        }
    };

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

    socket.on('rtc:ice-candidate', ({ to, candidate, roomId }) => {
        io.to(`user:${to}`).emit('rtc:ice-candidate', {
            from: socket.user.id.toString(),
            roomId,
            candidate,
        });
    });
};
