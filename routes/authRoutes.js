const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { protect } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitize(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    contactNumber: user.contactNumber,
    gender: user.gender,
  };
}

// Aggregates a user's rating (0-5 stars) from the votes on all coupons they've shared.
async function computeStats(userId) {
  const [voteAgg] = await Coupon.aggregate([
    { $match: { sharedBy: userId } },
    { $group: { _id: null, up: { $sum: '$upvotes' }, down: { $sum: '$downvotes' } } },
  ]);

  const up = voteAgg?.up || 0;
  const down = voteAgg?.down || 0;
  const totalVotes = up + down;
  const rating = totalVotes === 0 ? 0 : Math.round((up / totalVotes) * 5 * 10) / 10;

  const sharedCount = await Coupon.countDocuments({ sharedBy: userId });
  const validSharedCount = await Coupon.countDocuments({ sharedBy: userId, expiryDate: { $gte: new Date() } });

  return { rating, sharedCount, validSharedCount, totalVotes };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, contactNumber, gender, password } = req.body;
    if (!name || !email || !contactNumber || !gender || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, contactNumber, gender, password });
    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
});

// GET /api/auth/me - profile + dashboard stats (rating, shared count, valid shared count)
router.get('/me', protect, async (req, res) => {
  const stats = await computeStats(req.user._id);
  res.json({ user: sanitize(req.user), stats });
});

module.exports = router;
