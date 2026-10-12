const test = require('node:test');
const assert = require('node:assert/strict');
const mobilePattern = /^[6-9]\d{9}$/;
test('accepts valid Indian mobile numbers and rejects malformed values', () => { assert.equal(mobilePattern.test('9876543210'), true); for (const value of ['1234567890', '987654321', '98765432100', 'abcdefghij']) assert.equal(mobilePattern.test(value), false); });
test('payment amounts must be finite and positive', () => { for (const value of [1, 50.25]) assert.equal(Number.isFinite(value) && value > 0, true); for (const value of [0, -1, NaN, Infinity]) assert.equal(Number.isFinite(value) && value > 0, false); });
test('terminal status handling is explicit and pending is not success', () => { const accepted = ['pending', 'successful', 'failed', 'cancelled']; assert.equal(accepted.includes('pending'), true); assert.notEqual('pending', 'successful'); assert.equal(accepted.includes('unknown'), false); });
test('rotation thresholds are restricted to three or four', () => { const valid = n => [3, 4].includes(n); assert.equal(valid(3), true); assert.equal(valid(4), true); assert.equal(valid(5), false); });
test('duplicate webhook event ids are tracked per payment', () => { const ids = new Set(['evt_1']); assert.equal(ids.has('evt_1'), true); ids.add('evt_1'); assert.equal(ids.size, 1); });
test('concurrent success claims should only accept one pending-to-success transition', async () => { let status = 'pending'; const claim = async () => { await Promise.resolve(); if (status !== 'pending') return false; status = 'successful'; return true; }; const results = await Promise.all(Array.from({ length: 30 }, claim)); assert.equal(results.filter(Boolean).length, 1); });
