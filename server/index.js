const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev, restrict in prod
    methods: ["GET", "POST"]
  }
});

// Store sessions in memory
const sessions = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Narrator creates a session
  socket.on('create-session', ({ sessionId, sessionName }) => {
    sessions[sessionId] = {
      name: sessionName,
      narratorId: socket.id,
      listeners: []
    };
    socket.join(sessionId);
    socket.emit('session-created', sessionId);
    console.log(`Session created: ${sessionName} (${sessionId})`);
  });

  // Listener joins a session
  socket.on('join-session', ({ sessionId, userName }) => {
    const session = sessions[sessionId];
    if (session) {
      session.listeners.push({ id: socket.id, name: userName });
      socket.join(sessionId);

      // Notify listener of success
      socket.emit('session-joined', { sessionName: session.name });

      // Notify narrator of new listener
      io.to(session.narratorId).emit('listener-update', session.listeners);

      console.log(`${userName} joined session ${sessionId}`);
    } else {
      socket.emit('error', 'Session not found');
    }
  });

  // Handle feedback from listener
  socket.on('feedback', (data) => {
    // data: { value, timestamp }
    // Find which session this socket is in
    // (In a real app, we'd map socket.id to sessionId, but here we can iterate or use room info)
    // Simple way: broadcast to all rooms this socket is in (except their own id)

    // Better way: find the session where this socket is a listener
    for (const [sid, session] of Object.entries(sessions)) {
      const listener = session.listeners.find(l => l.id === socket.id);
      if (listener) {
        // Send to narrator
        io.to(session.narratorId).emit('feedback-update', {
          userId: socket.id,
          userName: listener.name,
          value: data.value,
          timestamp: data.timestamp
        });
        break;
      }
    }
  });

  // Handle session controls (optional, if we want to sync state)
  socket.on('start-session', () => {
    // Could broadcast to listeners if needed
  });

  socket.on('pause-session', () => {
    // Could broadcast to listeners if needed
  });

  socket.on('resume-session', () => {
    // Could broadcast to listeners if needed
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove listener from sessions
    for (const [sid, session] of Object.entries(sessions)) {
      const index = session.listeners.findIndex(l => l.id === socket.id);
      if (index !== -1) {
        session.listeners.splice(index, 1);
        io.to(session.narratorId).emit('listener-update', session.listeners);
        break;
      }
    }
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
