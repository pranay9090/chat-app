// ============================================================================
// Main Server Entry Point
// Express 5 app wrapped in Node HTTP server with Socket.io real-time support
// ============================================================================

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import initSocket from './socket/socketHandler.js';

// Connect to MongoDB database
connectDB();

// Initialize Express application
const app = express();

// Wrap Express app in a Node HTTP server
const server = http.createServer(app);

// Create Socket.io server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  },
});

// Make io accessible across all Express route controllers via req.app.get('io')
app.set('io', io);

// Initialize Socket.io events and logic
initSocket(io);

// Configure CORS for Express REST routes
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);

// Middleware to parse incoming JSON request bodies
app.use(express.json({ limit: '200kb' }));

// Test route to verify API is running
app.get('/', (req, res) => {
  res.send('API is running');
});

// Mount REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Read port from environment variables or fallback to 5000
const PORT = process.env.PORT || 5000;

// Start the HTTP server (with Socket.io attached)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
