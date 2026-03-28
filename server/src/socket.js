const { Server } = require('socket.io');

// Store latest vitals in memory
let latestVitals = { temperature: 36.8, bpm: 80, status: 'NORMAL' };

function setLatestVitals(vitals) {
  latestVitals = { ...latestVitals, ...vitals };
}

function initSocket(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
  });

  io.on('connection', (socket) => {
    // Send immediate latest data on connection
    socket.emit('vitalsUpdate', latestVitals);

    // client should emit 'join' with { userId, role }
    socket.on('join', ({ userId, role }) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      if (role === 'doctor') socket.join(`doctors:${userId}`);
      if (role === 'patient') socket.join(`patients:${userId}`);
    });

    socket.on('disconnect', () => {});
  });

  return { io, setLatestVitals };
}

module.exports = initSocket;
