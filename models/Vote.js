const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['up', 'down'], required: true },
  },
  { timestamps: true }
);

// A user can only have one vote per coupon
voteSchema.index({ coupon: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
