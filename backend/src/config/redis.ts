import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const pubClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const subClient = pubClient.duplicate();

export const redis = new Redis(REDIS_URL);

pubClient.on('error', (err) => console.error('Redis Pub Client Error', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error', err));
redis.on('error', (err) => console.error('Redis Client Error', err));

console.log('✅ Redis Clients Initialized');
