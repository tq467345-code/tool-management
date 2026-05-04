const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM departments WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '班组不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '班组名称不能为空' });
  }

  const id = 'd' + Date.now();

  db.run('INSERT INTO departments (id, name) VALUES (?, ?)', [id, name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: '班组名称已存在' });
      }
      return res.status(500).json({ success: false, message: '创建失败' });
    }
    res.json({ success: true, message: '创建成功', data: { id, name } });
  });
});

router.put('/:id', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '班组名称不能为空' });
  }

  db.run('UPDATE departments SET name = ? WHERE id = ?', [name, req.params.id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: '班组名称已存在' });
      }
      return res.status(500).json({ success: false, message: '更新失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '班组不存在' });
    }
    res.json({ success: true, message: '更新成功', data: { id: req.params.id, name } });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }
    if (row && row.count > 0) {
      return res.status(400).json({ success: false, message: '无法删除班组，该班组下有用户' });
    }

    db.get('SELECT COUNT(*) as count FROM tools WHERE department_id = ?', [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库查询失败' });
      }
      if (row && row.count > 0) {
        return res.status(400).json({ success: false, message: '无法删除班组，该班组下有工具' });
      }

      db.run('DELETE FROM departments WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: '删除失败' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: '班组不存在' });
        }
        res.json({ success: true, message: '删除成功' });
      });
    });
  });
});

module.exports = router;
