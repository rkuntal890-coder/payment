const jwt = require('jsonwebtoken');
module.exports = function admin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { if (!token || !process.env.JWT_SECRET) throw new Error(); req.admin = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Admin authentication required.' }); }
};
