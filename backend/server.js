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

const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://delhi-bijnor-rides.vercel.app',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Allow non-browser clients (Postman, etc.)
  
  const normalizedOrigin = origin.replace(/\/$/, '');
  
  if (corsOrigins.includes(normalizedOrigin)) return true;
  // Allow all Vercel preview + production URLs
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)) return true;
  
  return false;
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin) ? origin : false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Health check (used to wake Render + verify deployment)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'delhi-bijnor-rides-api' });
});

// Root Route
app.get('/', (req, res) => {
res.send('Delhi Bijnor Rides Backend Running');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);

io.on('connection', (socket) => {
console.log('User connected:', socket.id);

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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    const PORT = process.env.PORT || 5000;
    const HOST = '0.0.0.0';

    server.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });
