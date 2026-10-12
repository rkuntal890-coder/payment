const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  rotationThreshold: { type: Number, enum: [3, 4], default: 4 },
  currentDestinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentDestination', default: null },
  successfulPaymentsOnCurrent: { type: Number, default: 0, min: 0 },
  rotationVersion: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('PaymentSettings', schema);
