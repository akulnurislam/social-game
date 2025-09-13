import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';
const REDIS_PUBSUB_URL = process.env['REDIS_PUBSUB_URL'] || 'redis://localhost:6379';

// General client
export const redis = new Redis(REDIS_URL);
redis.on('connect', () => console.log('[Redis] connected'));
redis.on('error', (err) => console.error('[Redis] error', err));

// Publisher connection
export const redisPublisher = new Redis(REDIS_PUBSUB_URL);
redisPublisher.on('connect', () => console.log('[Redis Publisher] connected'));
redisPublisher.on('error', (err) => console.error('[Redis Publisher] error', err));

// Subscriber connection
export const redisSubscriber = new Redis(REDIS_PUBSUB_URL);
redisSubscriber.on('connect', () => console.log('[Redis Subscriber] connected'));
redisSubscriber.on('error', (err) => console.error('[Redis Subscriber] error', err));
