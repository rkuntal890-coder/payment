const $ = selector => document.querySelector(selector);
const form = $('#paymentForm'); let currentUpi = ''; let activeReference = '';
$('#year').textContent = new Date().getFullYear();
$('#menuButton').addEventListener('click', () => { const menu = $('#menu'); menu.classList.toggle('hidden'); $('#menuButton').setAttribute('aria-expanded', String(!menu.classList.contains('hidden'))); });
$('#amendmentButton').addEventListener('click', () => $('#amendment').classList.toggle('hidden'));
$('#copyButton').addEventListener('click', async () => { if (!currentUpi) return; try { await navigator.clipboard.writeText(currentUpi); $('#copyButton').textContent = 'Copied!'; setTimeout(() => $('#copyButton').textContent = 'Copy UPI ID', 1600); } catch { showMessage('Copy is unavailable in this browser. Select and copy the UPI ID above.'); } });
function showMessage(message, success = false) { const el = $('#feedback'); el.textContent = message; el.classList.remove('hidden', 'success'); if (success) el.classList.add('success'); }
form.addEventListener('submit', async event => {
  event.preventDefault(); $('#feedback').classList.add('hidden');
  const mobileNumber = $('#mobile').value.trim(); const amount = Number($('#amount').value);
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) return showMessage('Enter a valid 10-digit Indian mobile number.');
  if (!Number.isFinite(amount) || amount <= 0) return showMessage('Enter an amount greater than ₹0.');
  const button = $('#payButton'); button.disabled = true; button.textContent = 'Creating request…';
  try {
    const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ mobileNumber, amount }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not create payment request.');
    currentUpi = data.merchantUpiId; activeReference = data.transactionReference; $('#upiId').textContent = currentUpi; $('#copyButton').disabled = false;
    $('#paymentResult').innerHTML = `<b>Payment request ready</b><img src="${data.qrCodeDataUrl}" alt="UPI payment QR code"><div class="result-meta">Amount: ₹${Number(data.amount).toFixed(2)}<br>Reference: <b>${data.transactionReference}</b><br>Status: <span class="status pending">Pending</span></div><p class="upi-link">${data.merchantUpiId}</p><a class="qr-action" href="${data.upiLink}">Open UPI app</a><p class="result-meta">Payment status changes only after provider verification.</p>`;
    $('#paymentResult').classList.remove('hidden'); showMessage('Request created. Complete payment in your UPI app, then wait for verified confirmation.', true); pollStatus();
  } catch (error) { showMessage(error.message); }
  finally { button.disabled = false; button.innerHTML = 'Pay Now <span aria-hidden="true">→</span>'; }
});
async function pollStatus() { const ref = activeReference; for (let i = 0; i < 10 && ref === activeReference; i++) { await new Promise(resolve => setTimeout(resolve, 5000)); try { const response = await fetch(`/api/payments/${encodeURIComponent(ref)}`); if (!response.ok) continue; const data = await response.json(); const status = $('#paymentResult .status'); if (status) { status.textContent = data.status; status.className = `status ${data.status}`; } if (data.status !== 'pending') { showMessage(`Payment status: ${data.status}.`, data.status === 'successful'); break; } } catch {} } }
