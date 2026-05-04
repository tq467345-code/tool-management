const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM tool_categories', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }
    res.json(rows);
  });
});

router.get('/export', (req, res) => {
  db.all('SELECT name FROM tool_categories', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '无数据可导出' });
    }

    const headers = ['Category Name'];
    const csvContent = [
      headers.join(','),
      ...rows.map(row => `"${row.name}"`)
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=categories_${Date.now()}.csv`);
    res.send('\uFEFF' + csvContent);
  });
});

router.post('/import', (req, res) => {
  const importedCategories = req.body;

  if (!Array.isArray(importedCategories)) {
    return res.status(400).json({ success: false, message: '导入数据必须为数组格式' });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  importedCategories.forEach((catData, index) => {
    try {
      if (!catData['Category Name']) {
        failCount++;
        errors.push(`第 ${index + 1} 行：类别名称为必填项`);
        return;
      }

      const id = 'c' + Date.now() + index;

      db.run(
        'INSERT OR IGNORE INTO tool_categories (id, name) VALUES (?, ?)',
        [id, catData['Category Name']],
        function(err) {
          if (err) {
            failCount++;
            errors.push(`第 ${index + 1} 行：导入失败 - ${err.message}`);
          } else if (this.changes > 0) {
            successCount++;
          } else {
            failCount++;
            errors.push(`第 ${index + 1} 行：类别已存在`);
          }
        }
      );
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
  }, 100);
});

router.get('/export/template', (req, res) => {
  const headers = ['Category Name'];
  const examples = [
    ['Measuring Tools'],
    ['Power Tools'],
    ['Hand Tools']
  ];

  const csvContent = [headers.join(','), ...examples.map(row => `"${row[0]}"`)].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=categories_import_template.csv');
  res.send('\uFEFF' + csvContent);
});

router.get('/:id', (req,res) => {
  db.get('SELECT * FROM tool_categories WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: '类别不存在' });
    }

    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, message: '类别名称不能为空' });
  }

  const id = 'c' + Date.now();

  db.run(
    'INSERT INTO tool_categories (id, name) VALUES (?, ?)',
    [id, name],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '插入失败' });
      }

      res.json({
        success: true,
        message: '创建成功',
        data: { id, name }
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '类别名称不能为空' });
  }

  db.run('UPDATE tool_categories SET name = ? WHERE id = ?', [name, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: '更新失败' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '类别不存在' });
    }

    res.json({
      success: true,
      message: '更新成功',
      data: { id: req.params.id, name }
    });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tool_categories WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: '删除失败' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '类别不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  });
});

module.exports = router;
