import { redis } from '../config/redis';

const RTC_ROOMS_PREFIX = 'rtc:room:';

export interface RTCParticipant {
    userId: string;
    name: string;
    socketId: string;
}

class RTCService {
    private getRoomKey(roomId: string) {
        return `${RTC_ROOMS_PREFIX}${roomId}`;
    }

    async joinRoom(roomId: string, userId: string, data: RTCParticipant) {
        const key = this.getRoomKey(roomId);
        await redis.hset(key, userId, JSON.stringify(data));
        // Optional: Set expiry for room data if not cleaned up properly
        await redis.expire(key, 86400); // 24 hours
    }

    async leaveRoom(roomId: string, userId: string) {
        const key = this.getRoomKey(roomId);
        await redis.hdel(key, userId);
        const remaining = await redis.hlen(key);
        if (remaining === 0) {
            await redis.del(key);
        }
    }

    async getParticipants(roomId: string): Promise<RTCParticipant[]> {
        const key = this.getRoomKey(roomId);
        const users = await redis.hgetall(key);
        return Object.values(users).map(data => JSON.parse(data));
    }
}

export default new RTCService();
