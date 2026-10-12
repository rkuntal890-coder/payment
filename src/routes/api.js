const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const Payment = require('../models/Payment');
const Destination = require('../models/PaymentDestination');
const { ensureSettings, getCurrentDestination, recordVerifiedSuccess } = require('../services/rotation');
const admin = require('../middleware/admin');

const router = express.Router();
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', message: { error: 'Too many requests. Please try again later.' } });
const mobilePattern = /^[6-9]\d{9}$/;
const publicPayment = payment => ({ transactionReference: payment.transactionReference, amount: payment.amount, merchantUpiId: payment.merchantUpiId, status: payment.verificationMethod === 'manual' ? 'pending' : payment.status, createdAt: payment.createdAt });

router.post('/payments', paymentLimiter, async (req, res, next) => {
  try {
    const { mobileNumber, amount } = req.body || {};
    if (typeof mobileNumber !== 'string' || !mobilePattern.test(mobileNumber)) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 1000000) return res.status(400).json({ error: 'Enter an amount greater than ₹0 and at most ₹10,00,000.' });
    const destination = await getCurrentDestination();
    const transactionReference = `CP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const idempotencyKey = String(req.get('Idempotency-Key') || '').slice(0, 100) || undefined;
    let payment;
    try { payment = await Payment.create({ transactionReference, mobileNumber, amount: Math.round(Number(amount) * 100) / 100, merchantDestinationId: destination._id, merchantUpiId: destination.upiId, idempotencyKey }); }
    catch (err) { if (err.code === 11000 && idempotencyKey) payment = await Payment.findOne({ idempotencyKey }); else throw err; }
    const upiLink = `upi://pay?${new URLSearchParams({ pa: payment.merchantUpiId, pn: destination.displayName, am: payment.amount.toFixed(2), cu: 'INR', tn: `Payment ${payment.transactionReference}` }).toString()}`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiLink, { width: 240, margin: 1 });
    res.status(201).json({ ...publicPayment(payment), upiLink, qrCodeDataUrl, verification: 'pending' });
  } catch (err) { next(err); }
});

router.get('/payments/:reference', async (req, res) => {
  const payment = await Payment.findOne({ transactionReference: req.params.reference });
  if (!payment) return res.status(404).json({ error: 'Payment request not found.' });
  res.json(publicPayment(payment));
});

router.post('/webhooks/payment', async (req, res, next) => {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    const signature = req.get('x-provider-signature') || '';
    if (!secret) return res.status(503).json({ error: 'Payment verification is not configured.' });
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
    const sig = Buffer.from(signature); const exp = Buffer.from(expected);
    if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return res.status(401).json({ error: 'Invalid webhook signature.' });
    const { eventId, transactionReference, status, providerTransactionId } = req.body || {};
    if (!eventId || !transactionReference || !['successful', 'failed', 'cancelled', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid webhook payload.' });
    const payment = await Payment.findOne({ transactionReference });
    if (!payment) return res.status(404).json({ error: 'Payment request not found.' });
    if (payment.processedWebhookIds.includes(String(eventId))) return res.json({ received: true, duplicate: true });
    if (status === 'successful') {
      const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: 'pending', processedWebhookIds: { $ne: String(eventId) } }, { $set: { status, providerTransactionId: String(providerTransactionId || ''), verificationMethod: 'provider' }, $addToSet: { processedWebhookIds: String(eventId) } }, { new: true });
      if (claimed) await recordVerifiedSuccess(claimed.merchantDestinationId);
      else await Payment.updateOne({ _id: payment._id }, { $addToSet: { processedWebhookIds: String(eventId) } });
    } else {
      await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status, providerTransactionId: providerTransactionId || null }, $addToSet: { processedWebhookIds: String(eventId) } });
    }
    res.json({ received: true });
  } catch (err) { next(err); }
});

router.post('/admin/login', paymentLimiter, async (req, res) => {
  if (!process.env.JWT_SECRET || req.body?.username !== process.env.ADMIN_USERNAME || req.body?.password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin credentials.' });
  res.json({ token: jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' }) });
});
router.get('/admin/destinations', admin, async (req, res) => res.json(await Destination.find().sort({ createdAt: 1 }).lean()));
router.post('/admin/destinations', admin, async (req, res) => {
  const { displayName, upiId, authorized = false, active = false, isTest = true } = req.body || {};
  if (!displayName || typeof upiId !== 'string' || !/^[\w.-]{2,256}@[\w.-]{2,64}$/.test(upiId)) return res.status(400).json({ error: 'Provide a display name and valid UPI ID.' });
  res.status(201).json(await Destination.create({ displayName, upiId, authorized: Boolean(authorized), active: Boolean(active && authorized), isTest: Boolean(isTest) }));
});
router.patch('/admin/destinations/:id', admin, async (req, res) => {
  const allowed = {}; for (const key of ['displayName', 'active', 'authorized']) if (req.body?.[key] !== undefined) allowed[key] = req.body[key];
  if (allowed.authorized === false) allowed.active = false;
  if (allowed.active === true) { const existing = await Destination.findById(req.params.id); if (!existing?.authorized && allowed.authorized !== true) return res.status(400).json({ error: 'Authorize the destination before activating it.' }); }
  const destination = await Destination.findByIdAndUpdate(req.params.id, { $set: allowed }, { new: true, runValidators: true });
  if (!destination) return res.status(404).json({ error: 'Destination not found.' });
  res.json(destination);
});
router.delete('/admin/destinations/:id', admin, async (req, res) => {
  const destination = await Destination.findById(req.params.id);
  if (!destination) return res.status(404).json({ error: 'Destination not found.' });
  if (destination.active || destination.authorized) return res.status(409).json({ error: 'Deactivate and revoke this destination before deleting it.' });
  const Settings = require('../models/PaymentSettings');
  await Settings.updateOne({ key: 'global', currentDestinationId: destination._id }, { $set: { currentDestinationId: null, successfulPaymentsOnCurrent: 0 } });
  await destination.deleteOne();
  res.json({ deleted: true });
});
router.patch('/admin/settings/rotation', admin, async (req, res) => {
  const threshold = Number(req.body?.rotationThreshold);
  if (![3, 4].includes(threshold)) return res.status(400).json({ error: 'Rotation threshold must be 3 or 4.' });
  const settings = await ensureSettings();
  res.json(await settings.updateOne({ $set: { rotationThreshold: threshold } }));
});

module.exports = router;
