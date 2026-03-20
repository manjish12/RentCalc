// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import admin from 'firebase-admin';
import messageRoutes from './routes/messageRoutes.js';
import connectDB from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import rentRoutes from './routes/rentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import yearRoutes from './routes/yearRoutes.js';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ============================================
// Initialize Firebase Admin SDK
// ============================================
try {
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.log('⚠️ Push notifications will not work without Firebase Admin SDK');
}

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Socket.io Setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

global.onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    global.onlineUsers.set(userId, socket.id);
    console.log(`User connected: ${userId}`);
  }
  socket.on('disconnect', () => {
    if (userId) {
      global.onlineUsers.delete(userId);
      console.log(`User disconnected: ${userId}`);
    }
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rents', rentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/years', yearRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Not Found - ${req.originalUrl}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});