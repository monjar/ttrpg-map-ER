const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { SOCKET_EVENTS } = require('../shared/constants');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared constants
app.get('/shared/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// Store game sessions
const gameSessions = new Map();

// Game session structure:
// {
//   id: string,
//   gmSocketId: string,
//   gmName: string,
//   players: Map<socketId, {name, isGM}>,
//   tokens: Array<{id, type, col, row, label}>,
//   createdAt: Date
// }

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new game session
  socket.on(SOCKET_EVENTS.CREATE_SESSION, (data) => {
    const { sessionId, gmName } = data;
    
    if (gameSessions.has(sessionId)) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: 'Session already exists' });
      return;
    }

    const session = {
      id: sessionId,
      gmSocketId: socket.id,
      gmName: gmName || 'Game Master',
      players: new Map([[socket.id, { name: gmName || 'Game Master', isGM: true }]]),
      tokens: [],
      createdAt: new Date()
    };

    gameSessions.set(sessionId, session);
    socket.join(sessionId);
    socket.currentSession = sessionId;
    socket.isGM = true;

    console.log(`Session created: ${sessionId} by ${gmName}`);
    
    socket.emit(SOCKET_EVENTS.SESSION_CREATED, {
      sessionId,
      isGM: true,
      players: Array.from(session.players.values()),
      tokens: session.tokens
    });
  });

  // Join an existing session
  socket.on(SOCKET_EVENTS.JOIN_SESSION, (data) => {
    const { sessionId, playerName } = data;
    
    const session = gameSessions.get(sessionId);
    if (!session) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: 'Session not found' });
      return;
    }

    session.players.set(socket.id, { name: playerName || 'Player', isGM: false });
    socket.join(sessionId);
    socket.currentSession = sessionId;
    socket.isGM = false;

    console.log(`${playerName} joined session: ${sessionId}`);

    // Send current game state to the joining player
    socket.emit(SOCKET_EVENTS.SESSION_JOINED, {
      sessionId,
      isGM: false,
      players: Array.from(session.players.values()),
      tokens: session.tokens
    });

    // Notify others about the new player
    socket.to(sessionId).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      playerName: playerName || 'Player',
      players: Array.from(session.players.values())
    });
  });

  // Token added (GM only)
  socket.on(SOCKET_EVENTS.ADD_TOKEN, (data) => {
    const session = gameSessions.get(socket.currentSession);
    if (!session) return;

    // Check if sender is GM
    if (socket.id !== session.gmSocketId) {
      socket.emit(SOCKET_EVENTS.PERMISSION_DENIED, { message: 'Only the GM can add tokens' });
      return;
    }

    const token = {
      id: data.id,
      type: data.type,
      col: data.col,
      row: data.row,
      label: data.label
    };

    session.tokens.push(token);

    // Broadcast to all players in the session
    io.to(socket.currentSession).emit(SOCKET_EVENTS.TOKEN_ADDED, token);
  });

  // Token moved (GM only)
  socket.on(SOCKET_EVENTS.MOVE_TOKEN, (data) => {
    const session = gameSessions.get(socket.currentSession);
    if (!session) return;

    // Check if sender is GM
    if (socket.id !== session.gmSocketId) {
      socket.emit(SOCKET_EVENTS.PERMISSION_DENIED, { message: 'Only the GM can move tokens' });
      return;
    }

    // Convert id to number for comparison
    const tokenId = typeof data.id === 'string' ? parseInt(data.id) : data.id;
    const token = session.tokens.find(t => t.id === tokenId);
    if (token) {
      token.col = data.col;
      token.row = data.row;

      // Broadcast to all players except sender
      socket.to(socket.currentSession).emit(SOCKET_EVENTS.TOKEN_MOVED, {
        id: tokenId,
        col: data.col,
        row: data.row
      });
    }
  });

  // Token deleted (GM only)
  socket.on(SOCKET_EVENTS.DELETE_TOKEN, (data) => {
    const session = gameSessions.get(socket.currentSession);
    if (!session) return;

    // Check if sender is GM
    if (socket.id !== session.gmSocketId) {
      socket.emit(SOCKET_EVENTS.PERMISSION_DENIED, { message: 'Only the GM can delete tokens' });
      return;
    }

    // Convert id to number for comparison
    const tokenId = typeof data.id === 'string' ? parseInt(data.id) : data.id;
    const index = session.tokens.findIndex(t => t.id === tokenId);
    if (index !== -1) {
      session.tokens.splice(index, 1);

      // Broadcast to all players in the session
      io.to(socket.currentSession).emit(SOCKET_EVENTS.TOKEN_DELETED, { id: tokenId });
    }
  });

  // Get list of active sessions (for future use)
  socket.on(SOCKET_EVENTS.LIST_SESSIONS, () => {
    const sessions = Array.from(gameSessions.values()).map(s => ({
      id: s.id,
      gmName: s.gmName,
      playerCount: s.players.size,
      createdAt: s.createdAt
    }));
    socket.emit(SOCKET_EVENTS.SESSIONS_LIST, sessions);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    const sessionId = socket.currentSession;
    if (!sessionId) return;

    const session = gameSessions.get(sessionId);
    if (!session) return;

    const player = session.players.get(socket.id);
    session.players.delete(socket.id);

    // If GM disconnects, notify players and optionally close session
    if (socket.id === session.gmSocketId) {
      console.log(`GM disconnected from session: ${sessionId}`);
      io.to(sessionId).emit(SOCKET_EVENTS.GM_DISCONNECTED, { 
        message: 'Game Master has disconnected. Session will be closed.' 
      });
      
      // Clean up session after GM disconnect
      setTimeout(() => {
        gameSessions.delete(sessionId);
        console.log(`Session ${sessionId} deleted after GM disconnect`);
      }, 5000);
    } else {
      // Regular player disconnected
      io.to(sessionId).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        playerName: player?.name,
        players: Array.from(session.players.values())
      });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeSessions: gameSessions.size,
    timestamp: new Date().toISOString()
  });
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`TTRPG Battle Map Server Running`);
  console.log(`=================================`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Active sessions: ${gameSessions.size}`);
  console.log(`=================================`);
});
