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

// ... (rest of socket logic) ...

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
