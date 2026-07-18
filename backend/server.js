require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());

const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://delhi-bijnor-rides.vercel.app',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return process.env.NODE_ENV !== 'production'; // Block non-browser in production
  
  const normalizedOrigin = origin.replace(/\/$/, '');
  
  if (corsOrigins.includes(normalizedOrigin)) return true;
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

// Payload size limit to prevent DoS
app.use(express.json({ limit: '10kb' }));

// Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for auth routes
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// ── Express v5: Handle JSON parse errors cleanly ──────────────────────────────
// In Express 5, body-parser errors are thrown (not passed to next), so we need
// an error-handling middleware right after express.json() to catch SyntaxErrors.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON in request body.' });
  }
  next(err);
});

// Health check (used to wake Render + verify deployment)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'delhi-bijnor-rides-api' });
});

// Root Route
app.get('/', (req, res) => {
res.send('Delhi Bijnor Rides Backend Running');
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
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

// ── Global error handler (Express v5) ───────────────────────────────────────
// Must have 4 params so Express recognises it as an error handler.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
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
