import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

export const redisEnabled = Boolean(REDIS_URL);

export const pubClient = redisEnabled
  ? new Redis(REDIS_URL as string, {
      maxRetriesPerRequest: null,
    })
  : null;

export const subClient = pubClient ? pubClient.duplicate() : null;

export const redis = redisEnabled ? new Redis(REDIS_URL as string) : null;

if (pubClient && subClient && redis) {
  pubClient.on('error', (err) => console.error('Redis Pub Client Error', err));
  subClient.on('error', (err) => console.error('Redis Sub Client Error', err));
  redis.on('error', (err) => console.error('Redis Client Error', err));
  console.log('Redis clients initialized.');
} else {
  console.log('Redis disabled: REDIS_URL is not set.');
}
