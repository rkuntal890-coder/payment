let token = sessionStorage.getItem('adminToken') || '';
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function load() {
  const destinations = await request('/api/admin/destinations');
  document.querySelector('#destinations').innerHTML = destinations.map(d => `<p><b>${escapeHtml(d.displayName)}</b> · ${escapeHtml(d.upiId)} · ${d.successfulPaymentCount} verified · ${d.isTest ? 'TEST' : 'LIVE'} · authorized ${d.authorized} · active ${d.active} <button data-id="${d._id}" data-action="authorize">${d.authorized ? 'Revoke' : 'Authorize'}</button> <button data-id="${d._id}" data-action="active">${d.active ? 'Deactivate' : 'Activate'}</button> <button data-id="${d._id}" data-action="delete">Delete</button></p>`).join('') || 'No destinations yet';
}
async function init() {
  if (!token) return;
  try { await load(); document.querySelector('#login').classList.add('hidden'); document.querySelector('#dashboard').classList.remove('hidden'); }
  catch (e) { token = ''; sessionStorage.removeItem('adminToken'); document.querySelector('#login').classList.remove('hidden'); document.querySelector('#dashboard').classList.add('hidden'); document.querySelector('#message').textContent = e.message; }
}
document.querySelector('#login').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.currentTarget);
  try { const result = await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) }); token = result.token; sessionStorage.setItem('adminToken', token); await init(); }
  catch (err) { document.querySelector('#message').textContent = err.message; }
});
document.querySelector('#logout').addEventListener('click', () => { token = ''; sessionStorage.removeItem('adminToken'); document.querySelector('#dashboard').classList.add('hidden'); document.querySelector('#login').classList.remove('hidden'); document.querySelector('#login').reset(); });
document.querySelector('#saveThreshold').addEventListener('click', async () => { try { await request('/api/admin/settings/rotation', { method: 'PATCH', body: JSON.stringify({ rotationThreshold: Number(document.querySelector('#threshold').value) }) }); } catch (e) { alert(e.message); } });
document.querySelector('#addDestination').addEventListener('click', async () => { try { await request('/api/admin/destinations', { method: 'POST', body: JSON.stringify({ displayName: document.querySelector('#displayName').value, upiId: document.querySelector('#upi').value, isTest: true }) }); await load(); } catch (e) { alert(e.message); } });
document.querySelector('#destinations').addEventListener('click', async e => {
  const action = e.target.dataset.action; if (!action) return; const id = e.target.dataset.id;
  try {
    const list = await request('/api/admin/destinations'); const d = list.find(x => x._id === id);
    if (action === 'delete') {
      if (d.active || d.authorized) return alert('Deactivate and revoke this destination before deleting it.');
      if (!confirm(`Permanently delete ${d.upiId}? Existing payment history will retain its saved UPI ID.`)) return;
      await request(`/api/admin/destinations/${id}`, { method: 'DELETE' });
    } else {
      const update = action === 'authorize' ? { authorized: !d.authorized, active: false } : { active: !d.active };
      await request(`/api/admin/destinations/${id}`, { method: 'PATCH', body: JSON.stringify(update) });
    }
    await load();
  } catch (error) { alert(error.message); }
});
init();
