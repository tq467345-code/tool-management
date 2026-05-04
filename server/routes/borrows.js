const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { role, departmentId, userId } = req.user;
  
  let query = 'SELECT b.*, u.real_name as userName FROM borrow_records b LEFT JOIN users u ON b.user_id = u.id';
  let params = [];
  
  if (role === 'user') {
    query += ' WHERE b.user_id = ?';
    params.push(userId);
  } else if (role === 'dept_admin') {
    query += ' WHERE b.department_id = ?';
    params.push(departmentId);
  }

  query += ' ORDER BY b.borrow_date DESC, b.borrow_time DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }
    
    const result = rows.map(row => ({
      id: row.id,
      toolId: row.tool_id,
      toolName: row.tool_name,
      toolCategory: row.tool_category,
      userId: row.user_id,
      userName: row.userName,
      borrowDate: row.borrow_date,
      borrowTime: row.borrow_time,
      returnDate: row.return_date,
      returnTime: row.return_time,
      status: row.status,
      borrowReason: row.borrow_reason,
      departmentId: row.department_id
    }));
    
    res.json(result);
  });
});

router.post('/', (req, res) => {
  const { toolId, toolName, toolCategory, userId, borrowReason, departmentId } = req.body;
  
  if (!toolId || !toolName || !userId) {
    return res.status(400).json({ success: false, message: '必填字段不能为空' });
  }

  const id = 'b' + Date.now();
  const now = new Date();

  db.run(
    'INSERT INTO borrow_records (id, tool_id, tool_name, tool_category, user_id, borrow_date, borrow_time, status, borrow_reason, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, toolId, toolName, toolCategory, userId, now.toISOString().split('T')[0], now.toTimeString().slice(0, 8), 'borrowed', borrowReason || '', departmentId],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '插入失败' });
      }

      res.json({
        success: true,
        message: '创建成功',
        data: {
          id,
          toolId,
          toolName,
          toolCategory,
          userId,
          borrowDate: now.toISOString().split('T')[0],
          borrowTime: now.toTimeString().slice(0, 8),
          status: 'borrowed',
          borrowReason: borrowReason || '',
          departmentId
        }
      });
    }
  );
});

router.put('/:id/return', (req, res) => {
  const now = new Date();

  db.run(
    'UPDATE borrow_records SET status = ?, return_date = ?, return_time = ? WHERE id = ?',
    ['returned', now.toISOString().split('T')[0], now.toTimeString().slice(0, 8), req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      res.json({
        success: true,
        message: '归还成功'
      });
    }
  );
});

router.get('/export', (req, res) => {
  const { role, departmentId, userId } = req.user;
  
  let query = 'SELECT b.tool_name, b.tool_category, b.borrow_date, b.borrow_time, b.return_date, b.return_time, b.status, b.borrow_reason, u.real_name as userName, d.name as departmentName FROM borrow_records b LEFT JOIN users u ON b.user_id = u.id LEFT JOIN departments d ON b.department_id = d.id';
  let params = [];
  
  if (role === 'user') {
    query += ' WHERE b.user_id = ?';
    params.push(userId);
  } else if (role === 'dept_admin') {
    query += ' WHERE b.department_id = ?';
    params.push(departmentId);
  }

  query += ' ORDER BY b.borrow_date DESC, b.borrow_time DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库查询失败' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '无数据可导出' });
    }

    const headers = ['Tool Name', 'Category', 'User', 'Department', 'Borrow Date', 'Borrow Time', 'Return Date', 'Return Time', 'Status', 'Borrow Reason'];
    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        `"${row.tool_name}"`,
        `"${row.tool_category}"`,
        `"${row.userName || ''}"`,
        `"${row.departmentName || ''}"`,
        `"${row.borrow_date || ''}"`,
        `"${row.borrow_time || ''}"`,
        `"${row.return_date || ''}"`,
        `"${row.return_time || ''}"`,
        `"${row.status === 'borrowed' ? 'Borrowed' : 'Returned'}"`,
        `"${row.borrow_reason || ''}"`
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=borrows_${Date.now()}.csv`);
    res.send('\uFEFF' + csvContent);
  });
});

router.post('/import', (req, res) => {
  const { role, departmentId, userId } = req.user;
  const importedBorrows = req.body;

  if (!Array.isArray(importedBorrows)) {
    return res.status(400).json({ success: false, message: '导入数据必须为数组格式' });
  }

  const successCount = { value: 0 };
  const failCount = { value: 0 };
  const errors = [];

  const processBorrows = (index) => {
    if (index >= importedBorrows.length) {
      return res.json({
        success: true,
        message: `导入完成：${successCount.value} 成功，${failCount.value} 失败`,
        successCount: successCount.value,
        failCount: failCount.value,
        errors
      });
    }

    const borrowData = importedBorrows[index];

    if (!borrowData['Tool Name']) {
      failCount.value++;
      errors.push(`第 ${index + 1} 行：工具名称为必填项`);
      return processBorrows(index + 1);
    }

    if (!borrowData['User']) {
      failCount.value++;
      errors.push(`第 ${index + 1} 行：用户名为必填项`);
      return processBorrows(index + 1);
    }

    db.get('SELECT id, available FROM tools WHERE name = ?', [borrowData['Tool Name']], (err, tool) => {
      if (err || !tool) {
        failCount.value++;
        errors.push(`第 ${index + 1} 行：工具不存在`);
        return processBorrows(index + 1);
      }

      db.get('SELECT id FROM users WHERE real_name = ?', [borrowData['User']], (err, user) => {
        if (err || !user) {
          failCount.value++;
          errors.push(`第 ${index + 1} 行：用户不存在`);
          return processBorrows(index + 1);
        }

        let deptId = departmentId;
        if (role === 'super_admin' && borrowData['Department']) {
          db.get('SELECT id FROM departments WHERE name = ?', [borrowData['Department']], (err, dept) => {
            if (dept) {
              deptId = dept.id;
            }
          });
        }

        const id = 'b' + Date.now() + index;
        const now = new Date();
        const borrowDate = borrowData['Borrow Date'] || now.toISOString().split('T')[0];
        const borrowTime = borrowData['Borrow Time'] || now.toTimeString().slice(0, 8);

        db.run(
          'INSERT INTO borrow_records (id, tool_id, tool_name, tool_category, user_id, borrow_date, borrow_time, status, borrow_reason, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, tool.id, borrowData['Tool Name'], borrowData['Category'] || '', user.id, borrowDate, borrowTime, 'borrowed', borrowData['Borrow Reason'] || '', deptId],
          function(err) {
            if (err) {
              failCount.value++;
              errors.push(`第 ${index + 1} 行：导入失败`);
            } else {
              successCount.value++;
            }
            processBorrows(index + 1);
          }
        );
      });
    });
  };

  processBorrows(0);
});

router.get('/export/template', (req, res) => {
  const headers = ['Tool Name', 'Category', 'User', 'Department', 'Borrow Date', 'Borrow Time', 'Borrow Reason'];
  const examples = [
    ['Multimeter', 'Measuring Tools', 'User One', 'Maintenance Team 1', '2024-01-01', '09:00:00', 'Regular maintenance'],
    ['Drill', 'Power Tools', 'User Two', 'Maintenance Team 2', '2024-01-02', '10:30:00', 'Equipment installation']
  ];

  const csvContent = [
    headers.join(','),
    ...examples.map(row => row.map(v => `"${v}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=borrows_import_template.csv');
  res.send('\uFEFF' + csvContent);
});

module.exports = router;
