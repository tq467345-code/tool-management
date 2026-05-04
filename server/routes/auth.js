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
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (loginAttempts[clientIP] && loginAttempts[clientIP].lockedUntil > Date.now()) {
    const remainingSeconds = Math.ceil((loginAttempts[clientIP].lockedUntil - Date.now()) / 1000);
    return res.status(429).json({ success: false, message: `账号已锁定，请在 ${remainingSeconds} 秒后重试` });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '服务器内部错误' });
    }

    if (!user) {
      incrementLoginAttempt(clientIP);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ success: false, message: '账号已被禁用，请联系管理员' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ success: false, message: '验证失败' });
      }

      if (!isMatch) {
        incrementLoginAttempt(clientIP);
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      loginAttempts[clientIP] = { attempts: 0, lockedUntil: 0 };

      // SSO: New login invalidates old tokens - use atomic increment to avoid race condition
      db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [user.id], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: '登录失败' });
        }

        // Get updated token_version
        db.get('SELECT token_version FROM users WHERE id = ?', [user.id], (err, row) => {
          if (err || !row) {
            return res.status(500).json({ success: false, message: '登录失败' });
          }

          const token = jwt.sign(
            { userId: user.id, tokenVersion: row.token_version },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
          );

          res.json({
            success: true,
            message: '登录成功',
            token,
            user: {
              id: user.id,
              username: user.username,
              realName: user.real_name,
              departmentId: user.department_id,
              role: user.role,
              status: user.status
            }
          });
        });
      });
    });
  });
});

router.post('/change-password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '参数不能为空' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '服务器内部错误' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    bcrypt.compare(oldPassword, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ success: false, message: '验证失败' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: '原密码错误' });
      }

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ success: false, message: '加密失败' });
        }

        // After changing password, increment token_version to invalidate other sessions
        db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, userId], (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: '更新失败' });
          }

          res.json({ success: true, message: '密码修改成功' });
        });
      });
    });
  });
});

// Validate token (real-time check user status)
router.get('/validate', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授权' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: '登录已过期' });
      }
      return res.status(401).json({ success: false, message: '无效的令牌' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: '服务器内部错误' });
      }

      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }

      // SSO check
      if (user.token_version !== decoded.tokenVersion) {
        return res.status(401).json({ success: false, message: '您的账号已在其他设备登录' });
      }

      // Account status check
      if (user.status === 'disabled') {
        return res.status(401).json({ success: false, message: '账号已被禁用' });
      }

      res.json({ success: true, message: '验证成功' });
    });
  });
});

function incrementLoginAttempt(clientIP) {
  const now = Date.now();

  // Cleanup old entries periodically to prevent memory leak
  if (Math.random() < 0.01) { // ~1% chance per call to cleanup
    for (const ip of Object.keys(loginAttempts)) {
      if (loginAttempts[ip].lockedUntil > 0 && loginAttempts[ip].lockedUntil < now) {
        delete loginAttempts[ip];
      }
    }
  }

  if (!loginAttempts[clientIP]) {
    loginAttempts[clientIP] = { attempts: 0, lockedUntil: 0 };
  }

  loginAttempts[clientIP].attempts++;

  if (loginAttempts[clientIP].attempts >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts[clientIP].lockedUntil = now + LOCKOUT_DURATION;
  }
}

module.exports = router;
