const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { JWT_SECRET, JWT_EXPIRES_IN, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } = require('../config');

const router = express.Router();
const loginAttempts = {};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password cannot be empty' });
  }
  const clientIP = req.ip || req.connection.remoteAddress;
  if (loginAttempts[clientIP] && loginAttempts[clientIP].lockedUntil > Date.now()) {
    const remainingSeconds = Math.ceil((loginAttempts[clientIP].lockedUntil - Date.now()) / 1000);
    return res.status(429).json({ success: false, message: `Account locked, please try again after ${remainingSeconds} seconds` });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Internal server error' });
    if (!user) { incrementLoginAttempt(clientIP); return res.status(401).json({ success: false, message: 'Incorrect username or password' }); }
    if (user.status === 'disabled') return res.status(403).json({ success: false, message: 'Account has been disabled, please contact administrator' });
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: 'Verification failed' });
      if (!isMatch) { incrementLoginAttempt(clientIP); return res.status(401).json({ success: false, message: 'Incorrect username or password' }); }
      loginAttempts[clientIP] = { attempts: 0, lockedUntil: 0 };
      db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [user.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Login failed' });
        db.get('SELECT token_version FROM users WHERE id = ?', [user.id], (err, row) => {
          if (err || !row) return res.status(500).json({ success: false, message: 'Login failed' });
          const token = jwt.sign({ userId: user.id, tokenVersion: row.token_version }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
          res.json({ success: true, message: 'Login successful', token, user: { id: user.id, username: user.username, realName: user.real_name, departmentId: user.department_id, role: user.role, status: user.status } });
        });
      });
    });
  });
});

router.post('/change-password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Parameters cannot be empty' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Internal server error' });
    if (!user) return res.status(404).json({ success: false, message: 'User does not exist' });
    bcrypt.compare(oldPassword, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: 'Verification failed' });
      if (!isMatch) return res.status(401).json({ success: false, message: 'Old password is incorrect' });
      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ success: false, message: 'Encryption failed' });
        db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, userId], (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Update failed' });
          res.json({ success: true, message: 'Password changed successfully' });
        });
      });
    });
  });
});

router.get('/validate', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Login expired' });
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) return res.status(500).json({ success: false, message: 'Internal server error' });
      if (!user) return res.status(401).json({ success: false, message: 'User does not exist' });
      if (user.token_version !== decoded.tokenVersion) return res.status(401).json({ success: false, message: 'Your account has been logged in elsewhere' });
      if (user.status === 'disabled') return res.status(401).json({ success: false, message: 'Account has been disabled' });
      res.json({ success: true, message: 'Valid' });
    });
  });
});

function incrementLoginAttempt(clientIP) {
  const now = Date.now();
  if (Math.random() < 0.01) {
    for (const ip of Object.keys(loginAttempts)) {
      if (loginAttempts[ip].lockedUntil > 0 && loginAttempts[ip].lockedUntil < now) delete loginAttempts[ip];
    }
  }
  if (!loginAttempts[clientIP]) loginAttempts[clientIP] = { attempts: 0, lockedUntil: 0 };
  loginAttempts[clientIP].attempts++;
  if (loginAttempts[clientIP].attempts >= MAX_LOGIN_ATTEMPTS) loginAttempts[clientIP].lockedUntil = now + LOCKOUT_DURATION;
}

module.exports = router;