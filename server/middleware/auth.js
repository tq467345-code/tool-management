const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { JWT_SECRET } = require('../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Login expired, please login again' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) return res.status(500).json({ success: false, message: 'Internal server error' });
      if (!user) return res.status(401).json({ success: false, message: 'User does not exist' });
      if (user.token_version !== decoded.tokenVersion) {
        return res.status(401).json({ success: false, message: 'Your account has been logged in elsewhere, please login again' });
      }
      if (user.status === 'disabled') {
        return res.status(401).json({ success: false, message: 'Account has been disabled, please contact administrator' });
      }
      req.user = { userId: user.id, username: user.username, role: user.role, departmentId: user.department_id };
      next();
    });
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };