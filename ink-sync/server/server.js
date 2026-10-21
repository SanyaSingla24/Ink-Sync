const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// 1. Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const boardRoutes = require('./routes/boards');
const messageRoutes = require('./routes/messages');
const accessRoutes = require('./routes/access');
const aiRoutes = require('./routes/ai'); // <-- Added AI routes here

// 2. Import socket handler
const socketHandler = require('./socket');

// 3. Initialize Express and Server
const app = express();
const server = http.createServer(app);

// 4. Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 5. Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// 6. Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 7. Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/ai', aiRoutes); // <-- Added AI route registration here

// 8. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'InkSync server is running' });
});

// 9. Initialize socket handlers
socketHandler(io);

// 10. Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});