import { redis } from '../config/redis';

const PRESENCE_KEY = 'presence:online_users';
const localPresence = new Map<string, OnlineUser>();

export interface OnlineUser {
  userId: string;
  name: string;
  socketId: string;
  connectedAt: string;
}

class PresenceService {
  async setUserOnline(userId: string, data: OnlineUser) {
    if (!redis) {
      localPresence.set(userId, data);
      return;
    }

    await redis.hset(PRESENCE_KEY, userId, JSON.stringify(data));
  }

  async setUserOffline(userId: string) {
    if (!redis) {
      localPresence.delete(userId);
      return;
    }

    await redis.hdel(PRESENCE_KEY, userId);
  }

  async getOnlineUsers(): Promise<Record<string, OnlineUser>> {
    if (!redis) {
      return Object.fromEntries(localPresence.entries());
    }

    const users = await redis.hgetall(PRESENCE_KEY);
    const parsed: Record<string, OnlineUser> = {};
    for (const [userId, data] of Object.entries(users)) {
      parsed[userId] = JSON.parse(data);
    }
    return parsed;
  }

  async isUserOnline(userId: string): Promise<boolean> {
    if (!redis) {
      return localPresence.has(userId);
    }

    return (await redis.hexists(PRESENCE_KEY, userId)) === 1;
  }
}

export default new PresenceService();
