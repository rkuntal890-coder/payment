const Destination = require('../models/PaymentDestination');
const Settings = require('../models/PaymentSettings');

async function ensureSettings() { return Settings.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global', rotationThreshold: 4 } }, { upsert: true, new: true }); }
async function getCurrentDestination() {
  const settings = await ensureSettings();
  let destination = settings.currentDestinationId && await Destination.findOne({ _id: settings.currentDestinationId, active: true, authorized: true });
  if (!destination) {
    destination = await Destination.findOne({ active: true, authorized: true }).sort({ createdAt: 1 });
    if (!destination) throw Object.assign(new Error('No active authorized payment destination is configured.'), { status: 503 });
    await Settings.updateOne({ key: 'global', currentDestinationId: settings.currentDestinationId }, { $set: { currentDestinationId: destination._id, successfulPaymentsOnCurrent: 0 } });
  }
  return destination;
}

// Called only after an authenticated, verified provider success. A per-settings
// version compare-and-swap serializes successful-count updates across workers.
async function recordVerifiedSuccess(destinationId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const settings = await ensureSettings();
    if (String(settings.currentDestinationId) !== String(destinationId)) {
      await Destination.updateOne({ _id: destinationId }, { $inc: { successfulPaymentCount: 1 } });
      return;
    }
    const count = settings.successfulPaymentsOnCurrent + 1;
    if (count < settings.rotationThreshold) {
      const result = await Settings.updateOne({ key: 'global', rotationVersion: settings.rotationVersion }, { $set: { successfulPaymentsOnCurrent: count }, $inc: { rotationVersion: 1 } });
      if (result.modifiedCount) { await Destination.updateOne({ _id: destinationId }, { $inc: { successfulPaymentCount: 1 } }); return; }
      continue;
    }
    const next = await Destination.findOne({ _id: { $ne: destinationId }, active: true, authorized: true }).sort({ createdAt: 1 });
    const result = await Settings.updateOne({ key: 'global', rotationVersion: settings.rotationVersion }, { $set: { currentDestinationId: next ? next._id : destinationId, successfulPaymentsOnCurrent: 0 }, $inc: { rotationVersion: 1 } });
    if (result.modifiedCount) { await Destination.updateOne({ _id: destinationId }, { $inc: { successfulPaymentCount: 1 } }); return; }
  }
  throw new Error('Could not safely update payment rotation; retry webhook.');
}
module.exports = { ensureSettings, getCurrentDestination, recordVerifiedSuccess };
