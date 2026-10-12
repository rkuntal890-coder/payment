require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const connectDB = require('./src/config/db');
const api = require('./src/routes/api');

const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], scriptSrc: ["'self'"] } } }));
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', api);
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) connectDB().then(() => app.listen(port, () => console.log(`Lendingplate running at http://localhost:${port}`))).catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
module.exports = app;
