const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName, u.department_id FROM users u LEFT JOIN departments d ON u.department_id = d.id';
  let params = [];

  if (role === 'dept_admin') {
    query += ' WHERE u.department_id = ?';
    params.push(departmentId);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    const result = rows.map(row => ({
      id: row.id,
      username: row.username,
      realName: row.real_name,
      role: row.role,
      departmentId: row.department_id,
      departmentName: row.departmentName,
      status: row.status || 'active'
    }));

    res.json(result);
  });
});

router.get('/export', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT u.username, u.real_name, u.role, d.name as departmentName FROM users u LEFT JOIN departments d ON u.department_id = d.id';
  let params = [];

  if (role === 'dept_admin') {
    query += ' WHERE u.department_id = ?';
    params.push(departmentId);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }

    const headers = ['Username', 'Name', 'Role', 'Department'];
    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        `"${row.username}"`,
        `"${row.real_name}"`,
        `"${row.role === 'super_admin' ? 'Super Admin' : row.role === 'dept_admin' ? 'Dept Admin' : 'Regular User'}"`,
        `"${row.departmentName || ''}"`
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.csv`);
    res.send('\uFEFF' + csvContent);
  });
});

router.post('/import', (req, res) => {
  const { role, departmentId } = req.user;
  const importedUsers = req.body;

  if (!Array.isArray(importedUsers)) {
    return res.status(400).json({ success: false, message: 'Import data must be array format' });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  importedUsers.forEach((userData, index) => {
    try {
      if (!userData['Username'] || !userData['Name'] || !userData['Role']) {
        failCount++;
        errors.push(`Row ${index + 1}: Username, Name, Role are required`);
        return;
      }

      const roleMap = {
        'Super Admin': 'super_admin',
        'Dept Admin': 'dept_admin',
        'Regular User': 'user'
      };
      const userRole = roleMap[userData['Role']];

      if (!userRole) {
        failCount++;
        errors.push(`Row ${index + 1}: Role must be Super Admin, Dept Admin, or Regular User`);
        return;
      }

      if (userRole === 'super_admin' && role !== 'super_admin') {
        failCount++;
        errors.push(`Row ${index + 1}: Only super admin can create super admin`);
        return;
      }

      let deptId = departmentId;
      if (role === 'super_admin' && userData['Department']) {
        db.get('SELECT id FROM departments WHERE name = ?', [userData['Department']], (err, dept) => {
          if (dept) {
            deptId = dept.id;
          }
        });
      }

      const id = userData['Username'];
      const defaultPassword = '123456';

      bcrypt.hash(defaultPassword, 10, (err, hash) => {
        if (err) {
          failCount++;
          errors.push(`Row ${index + 1}: Encryption failed`);
          return;
        }

        db.run(
          'INSERT OR IGNORE INTO users (id, username, password, real_name, department_id, role) VALUES (?, ?, ?, ?, ?, ?)',
          [id, userData['Username'], hash, userData['Name'], deptId, userRole],
          function(err) {
            if (err) {
              failCount++;
              errors.push(`Row ${index + 1}: Import failed - ${err.message}`);
            } else if (this.changes > 0) {
              successCount++;
            } else {
              failCount++;
              errors.push(`Row ${index + 1}: Username already exists`);
            }
          }
        );
      });
    } catch (error) {
      failCount++;
      errors.push(`Row ${index + 1}: Import failed - ${error.message}`);
    }
  });

  setTimeout(() => {
    res.json({
      success: true,
      message: `Import complete: ${successCount} success, ${failCount} failed`,
      successCount,
      failCount,
      errors
    });
  }, 200);
});

router.get('/export/template', (req, res) => {
  const headers = ['Username', 'Name', 'Role', 'Department'];
  const examples = [
    ['005', 'User Five', 'Regular User', 'Maintenance Team 1'],
    ['006', 'User Six', 'Dept Admin', 'Maintenance Team 3']
  ];

  const csvContent = [headers.join(','), ...examples.map(row => `"${row.join('","')}"`)]..join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.csv');
  res.send('\uFEFF' + csvContent);
});

router.get('/:id', (req, res) => {
  db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName, u.department_id FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'User does not exist' });
    }

    res.json({
      id: row.id,
      username: row.username,
      realName: row.real_name,
      role: row.role,
      departmentId: row.department_id,
      departmentName: row.departmentName,
      status: row.status || 'active'
    });
  });
});

router.post('/', (req, res) => {
  const { username, realName, role, departmentId } = req.body;

  if (!username || !realName || !role) {
    return res.status(400).json({ success: false, message: 'Required fields cannot be empty' });
  }

  const id = username;
  const defaultPassword = '123456';
  let deptId = req.user.role === 'super_admin' ? departmentId : req.user.departmentId;

  if (role === 'super_admin') {
    deptId = departmentId || null;
  } else if (!deptId) {
    return res.status(400).json({ success: false, message: 'Dept Admin and Regular User must select a department' });
  }

  bcrypt.hash(defaultPassword, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Encryption failed' });
    }

    db.run(
      'INSERT INTO users (id, username, password, real_name, department_id, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, hash, realName, deptId, role],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Insert failed: ' + err.message });
        }

        db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [id], (err, row) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Query failed' });
          }
          res.json({
            success: true,
            message: 'Created successfully, initial password is 123456',
            data: {
              id: row.id,
              username: row.username,
              realName: row.real_name,
              role: row.role,
              departmentName: row.departmentName,
              status: 'active'
            }
          });
        });
      }
    );
  });
});

router.put('/:id', (req, res) => {
  const { realName, role, departmentId } = req.body;
  const currentUserRole = req.user.role;
  const currentUserDeptId = req.user.departmentId;
  const targetUserId = req.params.id;

  if (targetUserId === req.user.userId && role) {
    return res.status(400).json({ success: false, message: 'Cannot modify your own role' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User does not exist' });
    }

    if (role && role !== user.role) {
      if (currentUserRole !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super admin can modify user roles' });
      }
      if (user.role === 'super_admin') {
        return res.status(403).json({ success: false, message: 'Cannot modify super admin role' });
      }
    }

    if (departmentId !== undefined && departmentId !== user.department_id) {
      if (currentUserRole !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super admin can modify user departments' });
      }
    }

    let updates = [];
    let params = [];

    if (realName) {
      updates.push('real_name = ?');
      params.push(realName);
    }
    if (role) {
      updates.push('role = ?');
      params.push(role);

      if (role !== 'super_admin' && !departmentId && !user.department_id) {
        return res.status(400).json({ success: false, message: 'Dept Admin and Regular User must select a department' });
      }
    }
    if (currentUserRole === 'super_admin') {
      updates.push('department_id = ?');
      params.push(role === 'super_admin' ? (departmentId || null) : departmentId);
    }

    params.push(targetUserId);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Update failed' });
      }

      db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [targetUserId], (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Query failed' });
        }
        res.json({
          success: true,
          message: 'Updated successfully',
          data: {
            id: row.id,
            username: row.username,
            realName: row.real_name,
            role: row.role,
            departmentName: row.departmentName,
            status: row.status || 'active'
          }
        });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  const targetUserId = req.params.id;
  const currentUserRole = req.user.role;
  const currentUserDeptId = req.user.departmentId;

  if (targetUserId === req.user.userId) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User does not exist' });
    }

    if (targetUserId === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin account' });
    }

    if (currentUserRole === 'user') {
      return res.status(403).json({ success: false, message: 'Regular users cannot delete accounts' });
    }

    if (currentUserRole === 'dept_admin') {
      if (user.role !== 'user') {
        return res.status(403).json({ success: false, message: 'Dept admin can only delete regular users' });
      }
      if (user.department_id !== currentUserDeptId) {
        return res.status(403).json({ success: false, message: 'Can only delete users in your department' });
      }
    }

    db.run('DELETE FROM users WHERE id = ?', [targetUserId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Delete failed' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'User does not exist' });
      }

      res.json({ success: true, message: 'Deleted successfully' });
    });
  });
});

router.post('/:id/reset-password', (req, res) => {
  const { adminPassword } = req.body;
  const targetUserId = req.params.id;
  const currentUserRole = req.user.role;
  const currentUserDeptId = req.user.departmentId;

  if (currentUserRole === 'dept_admin') {
    db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, targetUser) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database query failed' });
      }
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User does not exist' });
      }
      if (targetUser.role !== 'user') {
        return res.status(403).json({ success: false, message: 'Dept admin can only reset password for regular users' });
      }
      if (targetUser.department_id !== currentUserDeptId) {
        return res.status(403).json({ success: false, message: 'Can only reset password for users in your department' });
      }
      db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, admin) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database query failed' });
        }
        bcrypt.compare(adminPassword, admin.password, (err, isMatch) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Verification failed' });
          }
          if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Admin password is incorrect' });
          }
          const newPassword = '123456';
          bcrypt.hash(newPassword, 10, (err, hash) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Encryption failed' });
            }
            db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, targetUserId], function(err) {
              if (err) {
                return res.status(500).json({ success: false, message: 'Update failed' });
              }
              res.json({ success: true, message: 'Password has been reset to 123456, please login again' });
            });
          });
        });
      });
    });
  } else {
    db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, admin) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database query failed' });
      }
      bcrypt.compare(adminPassword, admin.password, (err, isMatch) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Verification failed' });
        }
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Admin password is incorrect' });
        }
        const newPassword = '123456';
        bcrypt.hash(newPassword, 10, (err, hash) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Encryption failed' });
          }
          db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, targetUserId], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Update failed' });
            }
            res.json({ success: true, message: 'Password has been reset to 123456, please login again' });
          });
        });
      });
    });
  }
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const targetUserId = req.params.id;
  const currentUserRole = req.user.role;

  if (currentUserRole !== 'super_admin' && currentUserRole !== 'dept_admin') {
    return res.status(403).json({ success: false, message: 'Only admins can operate account status' });
  }

  if (targetUserId === req.user.userId) {
    return res.status(400).json({ success: false, message: 'Cannot modify your own account status' });
  }

  if (!status || !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be active or disabled' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User does not exist' });
    }

    if (user.role === 'super_admin' && status === 'disabled' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admin can disable super admin' });
    }

    const tokenVersionUpdate = status === 'disabled' ? ', token_version = token_version + 1' : '';
    db.run(`UPDATE users SET status = ?${tokenVersionUpdate} WHERE id = ?`, [status, targetUserId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Update failed' });
      }

      if (status === 'disabled') {
        res.json({ success: true, message: 'Account has been disabled, user will be forced to logout' });
      } else {
        res.json({ success: true, message: 'Account has been enabled' });
      }
    });
  });
});

router.post('/:id/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Parameters cannot be empty' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User does not exist' });
    }

    bcrypt.compare(oldPassword, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Verification failed' });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Old password is incorrect' });
      }

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Encryption failed' });
        }

        db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, req.params.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Update failed' });
          }

          res.json({ success: true, message: 'Password changed successfully, please login again' });
        });
      });
    });
  });
});

module.exports = router;