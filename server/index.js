const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev, restrict in prod
    methods: ["GET", "POST"]
  }
});

// Store active sessions
// Map<sessionId, { name: string, startTime: number, paused: boolean, users: Map<socketId, string> }>
const sessions = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Narrator creates a session
  socket.on('create-session', ({ sessionId, sessionName }) => {
    sessions.set(sessionId, {
      name: sessionName,
      startTime: null,
      paused: false,
      users: new Map()
    });
    socket.join(sessionId);
    socket.data.role = 'narrator';
    socket.data.sessionId = sessionId;
    console.log(`Session created: ${sessionId} (${sessionName}) by ${socket.id}`);
    socket.emit('session-created', sessionId);
  });

  // Listener joins a session
  socket.on('join-session', ({ sessionId, userName }) => {
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.users.set(socket.id, userName);

      socket.join(sessionId);
      socket.data.role = 'listener';
      socket.data.sessionId = sessionId;
      socket.data.userName = userName;

      console.log(`Listener ${userName} (${socket.id}) joined session ${sessionId}`);
      socket.emit('session-joined', { sessionId, sessionName: session.name });

      // Notify narrator with full list
      const userList = Array.from(session.users.entries()).map(([id, name]) => ({ id, name }));
      io.to(sessionId).emit('listener-update', userList);
    } else {
      socket.emit('error', 'Session not found');
    }
  });

  // Narrator starts the session
  socket.on('start-session', () => {
    const { sessionId } = socket.data;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.startTime = Date.now();
      session.paused = false;
      io.to(sessionId).emit('session-started', session.startTime);
      console.log(`Session ${sessionId} started at ${session.startTime}`);
    }
  });

  socket.on('pause-session', () => {
    const { sessionId } = socket.data;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.paused = true;
      io.to(sessionId).emit('session-paused');
      console.log(`Session ${sessionId} paused`);
    }
  });

  socket.on('resume-session', () => {
    const { sessionId } = socket.data;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.paused = false;
      io.to(sessionId).emit('session-resumed');
      console.log(`Session ${sessionId} resumed`);
    }
  });

  // Listener sends feedback
  socket.on('feedback', (data) => {
    // data: { value: number, timestamp: number }
    const { sessionId } = socket.data;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);

      // Only accept feedback if session has started AND is not paused
      if (session.startTime && !session.paused) {
        io.to(sessionId).emit('feedback-update', {
          userId: socket.id,
          userName: socket.data.userName,
          value: data.value,
          timestamp: data.timestamp || Date.now()
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const { sessionId, role } = socket.data;

    if (sessionId && role === 'listener' && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.users.delete(socket.id);

      const userList = Array.from(session.users.entries()).map(([id, name]) => ({ id, name }));
      io.to(sessionId).emit('listener-update', userList);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
