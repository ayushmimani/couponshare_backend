const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, trim: true },
    brandLogo: { type: String, default: '' }, // URL, auto-fetched on create
    code: { type: String, required: true, trim: true, uppercase: true },
    expiryDate: { type: Date, required: true },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

couponSchema.index({ sharedBy: 1 });
couponSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
