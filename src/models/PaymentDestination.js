const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  upiId: { type: String, required: true, unique: true, trim: true, match: /^[\w.-]{2,256}@[\w.-]{2,64}$/ },
  active: { type: Boolean, default: false },
  authorized: { type: Boolean, default: false },
  successfulPaymentCount: { type: Number, default: 0, min: 0 },
  isTest: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('PaymentDestination', schema);
