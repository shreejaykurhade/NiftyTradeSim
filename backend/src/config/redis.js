const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
});

redisClient.on('error', (err) => console.error('❌ Redis error:', err));

async function connectRedis() {
  await redisClient.connect();
}

module.exports = { redisClient, connectRedis };
