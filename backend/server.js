require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict this to frontend URL
    methods: ['GET', 'POST']
  }
});

// Pass io to request object so controllers can access it if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);

io.on('connection', (socket) => {
  console.log('User connected via Socket.io:', socket.id);

  socket.on('join_ride', (rideId) => {
    if (rideId) {
      socket.join(`ride_${rideId}`);
    }
  });

  socket.on('leave_ride', (rideId) => {
    if (rideId) {
      socket.leave(`ride_${rideId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
  });
