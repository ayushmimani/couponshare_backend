require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const couponRoutes = require('./routes/couponRoutes');

const app = express();

// In production, set FRONTEND_URL to your deployed frontend's origin (e.g.
// https://coupon-share.vercel.app) so only that site can call the API.
// Left unset, it allows any origin - fine for local development.
const corsOptions = process.env.FRONTEND_URL ? { origin: process.env.FRONTEND_URL } : {};
app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/coupons', couponRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Server error.' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Coupon share API running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start();
