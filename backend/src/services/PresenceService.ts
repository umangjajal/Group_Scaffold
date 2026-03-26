import { redis } from '../config/redis';

const PRESENCE_KEY = 'presence:online_users';

export interface OnlineUser {
    userId: string;
    name: string;
    socketId: string;
    connectedAt: string;
}

class PresenceService {
    async setUserOnline(userId: string, data: OnlineUser) {
        await redis.hset(PRESENCE_KEY, userId, JSON.stringify(data));
    }

    async setUserOffline(userId: string) {
        await redis.hdel(PRESENCE_KEY, userId);
    }

    async getOnlineUsers(): Promise<Record<string, OnlineUser>> {
        const users = await redis.hgetall(PRESENCE_KEY);
        const parsed: Record<string, OnlineUser> = {};
        for (const [userId, data] of Object.entries(users)) {
            parsed[userId] = JSON.parse(data);
        }
        return parsed;
    }

    async isUserOnline(userId: string): Promise<boolean> {
        return (await redis.hexists(PRESENCE_KEY, userId)) === 1;
    }
}

export default new PresenceService();
