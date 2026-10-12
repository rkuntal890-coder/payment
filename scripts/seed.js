require('dotenv').config();
const connectDB = require('../src/config/db');
const Destination = require('../src/models/PaymentDestination');
const Settings = require('../src/models/PaymentSettings');
(async () => {
  await connectDB();
  await Destination.updateOne({ upiId: 'clearpay.test2@upi' }, { $set: { displayName: 'Lendingplate Local Test 2', upiId: 'clearpay.test2@upi', active: false, authorized: false, isTest: true } }, { upsert: true });
  await Settings.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global', rotationThreshold: 4, currentDestinationId: null, successfulPaymentsOnCurrent: 0 } }, { upsert: true });
  console.log('Inserted one inactive local test destination. Add and authorize a destination in the admin dashboard before accepting payments.'); process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
