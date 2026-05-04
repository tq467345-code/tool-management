const express = require('express');
const cors = require('cors');
const { PORT, RATE_LIMIT, RATE_LIMIT_WINDOW } = require('./config');
const { authenticateToken } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const toolsRouter = require('./routes/tools');
const usersRouter = require('./routes/users');
const categoriesRouter = require('./routes/categories');
const borrowsRouter = require('./routes/borrows');
const departmentsRouter = require('./routes/departments');
const { initDatabase } = require('./db/database');

const app = express();

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-secret-do-not-use-in-production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  if (!process.env.CORS_ORIGIN) {
    console.error('FATAL: CORS_ORIGIN environment variable is required in production');
    process.exit(1);
  }
}

const requestCounts = {};

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (Math.random() < 0.01) {
    const windowStart = now - RATE_LIMIT_WINDOW;
    for (const ip of Object.keys(requestCounts)) {
      if (requestCounts[ip].windowStart < windowStart) {
        delete requestCounts[ip];
      }
    }
  }

  if (!requestCounts[clientIP]) {
    requestCounts[clientIP] = { count: 0, windowStart: now };
  }

  if (now - requestCounts[clientIP].windowStart > RATE_LIMIT_WINDOW) {
    requestCounts[clientIP] = { count: 1, windowStart: now };
  } else {
    requestCounts[clientIP].count++;
  }

  if (requestCounts[clientIP].count > RATE_LIMIT) {
    return res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

app.use('/api/auth', authRouter);

app.use('/api/tools', authenticateToken, toolsRouter);
app.use('/api/users', authenticateToken, usersRouter);
app.use('/api/categories', authenticateToken, categoriesRouter);
app.use('/api/borrows', authenticateToken, borrowsRouter);
app.use('/api/departments', authenticateToken, departmentsRouter);

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
