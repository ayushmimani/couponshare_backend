const express = require('express');
const Coupon = require('../models/Coupon');
const Vote = require('../models/Vote');
const { protect } = require('../middleware/auth');
const { fetchBrandLogo } = require('../utils/fetchBrandLogo');

const router = express.Router();

function serializeCoupon(coupon, myVote) {
  return {
    id: coupon._id,
    brandName: coupon.brandName,
    brandLogo: coupon.brandLogo,
    code: coupon.code,
    expiryDate: coupon.expiryDate,
    isValid: new Date(coupon.expiryDate) >= new Date(),
    upvotes: coupon.upvotes,
    downvotes: coupon.downvotes,
    sharedBy: coupon.sharedBy?.name || 'Unknown',
    sharedById: coupon.sharedBy?._id || coupon.sharedBy,
    createdAt: coupon.createdAt,
    myVote: myVote || null, // 'up' | 'down' | null
  };
}

// GET /api/coupons - public feed of all shared coupons, newest first
router.get('/', protect, async (req, res) => {
  try {
    const coupons = await Coupon.find().populate('sharedBy', 'name').sort({ createdAt: -1 });

    // Attach the current user's own vote (if any) on each coupon, in one query.
    const votes = await Vote.find({ user: req.user._id, coupon: { $in: coupons.map((c) => c._id) } });
    const voteMap = new Map(votes.map((v) => [v.coupon.toString(), v.type]));

    res.json({ coupons: coupons.map((c) => serializeCoupon(c, voteMap.get(c._id.toString()))) });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch coupons.', error: err.message });
  }
});

// GET /api/coupons/mine - only the current user's shared coupons
router.get('/mine', protect, async (req, res) => {
  try {
    const coupons = await Coupon.find({ sharedBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ coupons: coupons.map((c) => serializeCoupon(c)) });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch your coupons.', error: err.message });
  }
});

// GET /api/coupons/brand-logo?name=Swiggy - live preview while the user types a brand name
router.get('/brand-logo', protect, async (req, res) => {
  try {
    const name = (req.query.name || '').trim();
    if (!name) return res.status(400).json({ message: 'name query param is required.' });
    const logo = await fetchBrandLogo(name);
    res.json({ logo });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch brand logo.', error: err.message });
  }
});

// POST /api/coupons - share a new coupon; brand logo is fetched automatically server-side
router.post('/', protect, async (req, res) => {
  try {
    const { brandName, code, expiryDate } = req.body;
    if (!brandName || !code || !expiryDate) {
      return res.status(400).json({ message: 'brandName, code and expiryDate are required.' });
    }

    const brandLogo = await fetchBrandLogo(brandName);

    const coupon = await Coupon.create({
      brandName,
      code,
      expiryDate,
      brandLogo,
      sharedBy: req.user._id,
    });

    const populated = await coupon.populate('sharedBy', 'name');
    res.status(201).json({ coupon: serializeCoupon(populated) });
  } catch (err) {
    res.status(500).json({ message: 'Could not create coupon.', error: err.message });
  }
});

// POST /api/coupons/:id/vote  Body: { type: 'up' | 'down' }
// Voting again with the same type un-votes; voting the opposite type switches the vote.
router.post('/:id/vote', protect, async (req, res) => {
  try {
    const { type } = req.body;
    if (!['up', 'down'].includes(type)) {
      return res.status(400).json({ message: 'type must be "up" or "down".' });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });

    if (coupon.sharedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't vote on your own coupon." });
    }

    const existingVote = await Vote.findOne({ coupon: coupon._id, user: req.user._id });

    let myVote = type;
    if (!existingVote) {
      await Vote.create({ coupon: coupon._id, user: req.user._id, type });
      coupon[type === 'up' ? 'upvotes' : 'downvotes'] += 1;
    } else if (existingVote.type === type) {
      // Same button clicked again - remove the vote
      await existingVote.deleteOne();
      coupon[type === 'up' ? 'upvotes' : 'downvotes'] -= 1;
      myVote = null;
    } else {
      // Switching from up to down or vice versa
      coupon[existingVote.type === 'up' ? 'upvotes' : 'downvotes'] -= 1;
      coupon[type === 'up' ? 'upvotes' : 'downvotes'] += 1;
      existingVote.type = type;
      await existingVote.save();
    }

    await coupon.save();
    const populated = await coupon.populate('sharedBy', 'name');
    res.json({ coupon: serializeCoupon(populated, myVote) });
  } catch (err) {
    res.status(500).json({ message: 'Could not register vote.', error: err.message });
  }
});

// DELETE /api/coupons/:id - only the coupon's owner can delete it
router.delete('/:id', protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });
    if (coupon.sharedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own coupons.' });
    }
    await coupon.deleteOne();
    await Vote.deleteMany({ coupon: coupon._id });
    res.json({ message: 'Coupon deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete coupon.', error: err.message });
  }
});

module.exports = router;
