const mongoose = require('mongoose');
const PaymentSchema = new mongoose.Schema({
  transactionReference: { type: String, required: true, unique: true, index: true },
  mobileNumber: { type: String, required: true, select: false },
  amount: { type: Number, required: true, min: 1 },
  merchantDestinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentDestination', required: true },
  merchantUpiId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'successful', 'failed', 'cancelled'], default: 'pending', index: true },
  providerTransactionId: { type: String, default: null },
  verificationMethod: { type: String, enum: ['provider', 'manual', null], default: null },
  idempotencyKey: { type: String, unique: true, sparse: true },
  processedWebhookIds: { type: [String], default: [] }
}, { timestamps: true });
PaymentSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Payment', PaymentSchema);
