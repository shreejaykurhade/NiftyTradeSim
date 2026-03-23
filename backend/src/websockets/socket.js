const { Server } = require('socket.io');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'].filter(Boolean),
      methods: ['GET', 'POST'],
    },
    // Tune for performance
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client can subscribe to specific symbols for targeted stock rooms
    socket.on('subscribe', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach((s) => socket.join(`stock:${s}`));
      }
    });

    socket.on('unsubscribe', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach((s) => socket.leave(`stock:${s}`));
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
