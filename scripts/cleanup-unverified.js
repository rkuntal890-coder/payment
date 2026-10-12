require('dotenv').config();
const connectDB = require('../src/config/db');
const Payment = require('../src/models/Payment');
const Destination = require('../src/models/PaymentDestination');
const Settings = require('../src/models/PaymentSettings');

(async () => {
  await connectDB();
  const result = await Payment.updateMany(
    { verificationMethod: 'manual' },
    { $set: { status: 'pending', verificationMethod: null, providerTransactionId: null } }
  );
  await Destination.updateMany({}, { $set: { successfulPaymentCount: 0 } });
  const counts = await Payment.aggregate([
    { $match: { status: 'successful', verificationMethod: 'provider' } },
    { $group: { _id: '$merchantDestinationId', count: { $sum: 1 } } }
  ]);
  for (const item of counts) await Destination.updateOne({ _id: item._id }, { $set: { successfulPaymentCount: item.count } });
  await Settings.updateOne({ key: 'global' }, { $set: { successfulPaymentsOnCurrent: 0 } });
  console.log(`Reset ${result.modifiedCount} manually marked payment(s) to pending; retained payment records and recalculated provider-verified counts.`);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
