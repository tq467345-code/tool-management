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
      return res.status(500).json({ success: false, message: '数据库查询失败' });
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
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '无数据可导出' });
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
    return res.status(400).json({ success: false, message: '导入数据必须为数组格式' });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  importedUsers.forEach((userData, index) => {
    try {
      if (!userData['Username'] || !userData['Name'] || !userData['Role']) {
        failCount++;
        errors.push(`第 ${index + 1} 行：账号、姓名、角色为必填项`);
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
        errors.push(`第 ${index + 1} 行：角色必须是系统超级管理员、班组管理员或普通用户`);
        return;
      }

      if (userRole === 'super_admin' && role !== 'super_admin') {
        failCount++;
        errors.push(`第 ${index + 1} 行：只有超级管理员才能创建超级管理员`);
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
          errors.push(`第 ${index + 1} 行：加密失败`);
          return;
        }

        db.run(
          'INSERT OR IGNORE INTO users (id, username, password, real_name, department_id, role) VALUES (?, ?, ?, ?, ?, ?)',
          [id, userData['Username'], hash, userData['Name'], deptId, userRole],
          function(err) {
            if (err) {
              failCount++;
              errors.push(`第 ${index + 1} 行：导入失败 - ${err.message}`);
            } else if (this.changes > 0) {
              successCount++;
            } else {
              failCount++;
              errors.push(`第 ${index + 1} 行：账号已存在`);
            }
          }
        );
      });
    } catch (error) {
      failCount++;
      errors.push(`第 ${index + 1} 行：导入失败 - ${error.message}`);
    }
  });

  setTimeout(() => {
    res.json({
      success: true,
      message: `导入完成：${successCount} 成功，${failCount} 失败`,
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

  const csvContent = [headers.join(','), ...examples.map(row => `"${row.join('","')}"`)].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.csv');
  res.send('\uFEFF' + csvContent);
});

router.get('/:id', (req, res) => {
  db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName, u.department_id FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: '用户不存在' });
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
    return res.status(400).json({ success: false, message: '必填字段不能为空' });
  }

  const id = username;
  const defaultPassword = '123456';
  let deptId = req.user.role === 'super_admin' ? departmentId : req.user.departmentId;

  if (role === 'super_admin') {
    deptId = departmentId || null;
  } else if (!deptId) {
    return res.status(400).json({ success: false, message: '班组管理员和普通用户必须选择班组' });
  }

  bcrypt.hash(defaultPassword, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ success: false, message: '加密失败' });
    }

    db.run(
      'INSERT INTO users (id, username, password, real_name, department_id, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, hash, realName, deptId, role],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '插入失败：' + err.message });
        }

        db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [id], (err, row) => {
          if (err) {
            return res.status(500).json({ success: false, message: '查询失败' });
          }
          res.json({
            success: true,
            message: '创建成功，默认密码为123456',
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
    return res.status(400).json({ success: false, message: '不能修改自己的角色' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (role && role !== user.role) {
      if (currentUserRole !== 'super_admin') {
        return res.status(403).json({ success: false, message: '只有超级管理员才能修改用户角色' });
      }
      if (user.role === 'super_admin') {
        return res.status(403).json({ success: false, message: '不能修改超级管理员的角色' });
      }
    }

    if (departmentId !== undefined && departmentId !== user.department_id) {
      if (currentUserRole !== 'super_admin') {
        return res.status(403).json({ success: false, message: '只有超级管理员才能修改用户班组' });
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
        return res.status(400).json({ success: false, message: '班组管理员和普通用户必须选择班组' });
      }
    }
    if (currentUserRole === 'super_admin') {
      updates.push('department_id = ?');
      params.push(role === 'super_admin' ? (departmentId || null) : departmentId);
    }

    params.push(targetUserId);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }

      db.get('SELECT u.id, u.username, u.real_name, u.role, d.name as departmentName FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [targetUserId], (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: '查询失败' });
        }
        res.json({
          success: true,
          message: '更新成功',
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
    return res.status(400).json({ success: false, message: '不能删除自己的账号' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (targetUserId === 'admin') {
      return res.status(403).json({ success: false, message: '不能删除管理员账号' });
    }

    if (currentUserRole === 'user') {
      return res.status(403).json({ success: false, message: '普通用户不能删除账号' });
    }

    if (currentUserRole === 'dept_admin') {
      if (user.role !== 'user') {
        return res.status(403).json({ success: false, message: '班组管理员只能删除普通用户' });
      }
      if (user.department_id !== currentUserDeptId) {
        return res.status(403).json({ success: false, message: '只能删除本班组的用户' });
      }
    }

    db.run('DELETE FROM users WHERE id = ?', [targetUserId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '删除失败' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }

      res.json({ success: true, message: '删除成功' });
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
        return res.status(500).json({ success: false, message: '数据库查询失败' });
      }
      if (!targetUser) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      if (targetUser.role !== 'user') {
        return res.status(403).json({ success: false, message: '班组管理员只能重置普通用户的密码' });
      }
      if (targetUser.department_id !== currentUserDeptId) {
        return res.status(403).json({ success: false, message: '只能重置本班组用户的密码' });
      }
      db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, admin) => {
        if (err) {
          return res.status(500).json({ success: false, message: '数据库查询失败' });
        }
        bcrypt.compare(adminPassword, admin.password, (err, isMatch) => {
          if (err) {
            return res.status(500).json({ success: false, message: '验证失败' });
          }
          if (!isMatch) {
            return res.status(401).json({ success: false, message: '管理员密码错误' });
          }
          const newPassword = '123456';
          bcrypt.hash(newPassword, 10, (err, hash) => {
            if (err) {
              return res.status(500).json({ success: false, message: '加密失败' });
            }
            db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, targetUserId], function(err) {
              if (err) {
                return res.status(500).json({ success: false, message: '更新失败' });
              }
              res.json({ success: true, message: '密码已重置为123456，请重新登录' });
            });
          });
        });
      });
    });
  } else {
    db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, admin) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库查询失败' });
      }
      bcrypt.compare(adminPassword, admin.password, (err, isMatch) => {
        if (err) {
          return res.status(500).json({ success: false, message: '验证失败' });
        }
        if (!isMatch) {
          return res.status(401).json({ success: false, message: '管理员密码错误' });
        }
        const newPassword = '123456';
        bcrypt.hash(newPassword, 10, (err, hash) => {
          if (err) {
            return res.status(500).json({ success: false, message: '加密失败' });
          }
          db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, targetUserId], function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: '更新失败' });
            }
            res.json({ success: true, message: '密码已重置为123456，请重新登录' });
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
    return res.status(403).json({ success: false, message: '只有管理员才能操作用户账号状态' });
  }

  if (targetUserId === req.user.userId) {
    return res.status(400).json({ success: false, message: '不能修改自己的账号状态' });
  }

  if (!status || !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ success: false, message: '状态必须为正常或停用' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (user.role === 'super_admin' && status === 'disabled' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: '只有超级管理员才能禁用超级管理员' });
    }

    const tokenVersionUpdate = status === 'disabled' ? ', token_version = token_version + 1' : '';
    db.run(`UPDATE users SET status = ?${tokenVersionUpdate} WHERE id = ?`, [status, targetUserId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }

      if (status === 'disabled') {
        res.json({ success: true, message: '账号已停用，用户将被强制登出' });
      } else {
        res.json({ success: true, message: '账号已启用' });
      }
    });
  });
});

router.post('/:id/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '参数不能为空' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
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

        db.run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [hash, req.params.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: '更新失败' });
          }

          res.json({ success: true, message: '密码修改成功，请重新登录' });
        });
      });
    });
  });
});

module.exports = router;
