const express = require('express');
const { db, runTransaction } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id';
  let params = [];

  if (role === 'dept_admin' || role === 'member') {
    query += ' WHERE t.department_id = ?';
    params.push(departmentId);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json(rows);
  });
});

// Get pending borrow requests - MUST be before /:id to avoid being matched as a tool ID
router.get('/pending-borrows', (req, res) => {
  const { role, departmentId, userId } = req.user;

  let query = 'SELECT pb.*, u.real_name as userName FROM pending_borrows pb LEFT JOIN users u ON pb.user_id = u.id';
  let params = [];

  if (role === 'member') {
    query += ' WHERE pb.user_id = ?';
    params.push(userId);
  } else if (role === 'dept_admin') {
    query += ' WHERE pb.department_id = ? AND pb.status = ?';
    params.push(departmentId, 'pending');
  }
  // super_admin can see all pending requests

  query += ' ORDER BY pb.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    const result = rows.map(row => ({
      id: row.id,
      toolId: row.tool_id,
      toolName: row.tool_name,
      toolCategory: row.tool_category,
      userId: row.user_id,
      userName: row.userName,
      quantity: row.quantity,
      borrowReason: row.borrow_reason,
      departmentId: row.department_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(result);
  });
});

router.get('/export', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT t.name, t.category, d.name as departmentName, t.total, t.available, t.location, t.description FROM tools t LEFT JOIN departments d ON t.department_id = d.id';
  let params = [];

  if (role === 'dept_admin' || role === 'member') {
    query += ' WHERE t.department_id = ?';
    params.push(departmentId);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }

    const headers = ['Tool Name', 'Category', 'Department', 'Total', 'Available', 'Location', 'Description'];
    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        `"${row.name || ''}"`,
        `"${row.category || ''}"`,
        `"${row.departmentName || ''}"`,
        row.total,
        row.available,
        `"${row.location || ''}"`,
        `"${row.description || ''}"`
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=tools_${Date.now()}.csv`);
    res.send('\uFEFF' + csvContent);
  });
});

router.post('/import', (req, res) => {
  const { role, departmentId } = req.user;
  const importedTools = req.body;

  if (!Array.isArray(importedTools)) {
    return res.status(400).json({ success: false, message: 'Import data must be array format' });
  }

  const successCount = { value: 0 };
  const failCount = { value: 0 };
  const errors = [];

  const processTools = (index) => {
    if (index >= importedTools.length) {
      return res.json({
        success: true,
        message: `Import complete: ${successCount.value} success, ${failCount.value} failed`,
        successCount: successCount.value,
        failCount: failCount.value,
        errors
      });
    }

    const toolData = importedTools[index];

    if (!toolData['Tool Name'] || !toolData['Category'] || !toolData['Total']) {
      failCount.value++;
      errors.push(`Row ${index + 1}: Tool Name, Category, Total are required`);
      return processTools(index + 1);
    }

    const total = parseInt(toolData['Total']);
    if (isNaN(total) || total <= 0) {
      failCount.value++;
      errors.push(`Row ${index + 1}: Total must be a positive number`);
      return processTools(index + 1);
    }

    let deptId = departmentId;
    if (role === 'super_admin' && toolData['Department']) {
      db.get('SELECT id FROM departments WHERE name = ?', [toolData['Department']], (err, dept) => {
        if (dept) {
          deptId = dept.id;
        }
      });
    }

    if (!deptId) {
      failCount.value++;
      errors.push(`Row ${index + 1}: Must select a department`);
      return processTools(index + 1);
    }

    const id = 't' + Date.now() + index;

    db.run(
      'INSERT INTO tools (id, name, category, department_id, total, available, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, toolData['Tool Name'], toolData['Category'], deptId, total, total, toolData['Location'] || '', toolData['Description'] || ''],
      function(err) {
        if (err) {
          failCount.value++;
          errors.push(`Row ${index + 1}: Import failed`);
        } else {
          successCount.value++;
        }
        processTools(index + 1);
      }
    );
  };

  processTools(0);
});

router.get('/export/template', (req, res) => {
  const headers = ['Tool Name', 'Category', 'Department', 'Total', 'Location', 'Description'];
  const examples = [
    ['Multimeter', 'Measuring Tools', 'Maintenance Team 1', '5', 'Warehouse A', 'Digital multimeter'],
    ['Drill', 'Power Tools', 'Maintenance Team 2', '3', 'Warehouse B', 'Cordless drill']
  ];

  const csvContent = [headers.join(','), ...examples.map(row => `"${row.join('","')}"`)].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=tools_import_template.csv');
  res.send('\uFEFF' + csvContent);
});

router.get('/:id', (req, res) => {
  db.get('SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'Tool does not exist' });
    }

    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, category, departmentId, total, location, description } = req.body;

  if (!name || !category || !total) {
    return res.status(400).json({ success: false, message: 'Required fields cannot be empty' });
  }

  const totalNum = parseInt(total);
  if (isNaN(totalNum) || totalNum <= 0) {
    return res.status(400).json({ success: false, message: 'Total must be greater than 0' });
  }

  const id = 't' + Date.now();
  const deptId = req.user.role === 'super_admin' ? departmentId : req.user.departmentId;

  if (!deptId) {
    return res.status(400).json({ success: false, message: 'Must select a department' });
  }

  db.run(
    'INSERT INTO tools (id, name, category, department_id, total, available, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, deptId, totalNum, totalNum, location || '', description || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Creation failed' });
      }

      db.get('SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?', [id], (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Query failed' });
        }
        res.json({
          success: true,
          message: 'Created successfully',
          data: row
        });
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, category, total, location, description } = req.body;

  db.get('SELECT * FROM tools WHERE id = ?', [req.params.id], (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool does not exist' });
    }

    let updates = [];
    let params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (category) {
      updates.push('category = ?');
      params.push(category);
    }
    if (total !== undefined) {
      const totalNum = parseInt(total);
      if (isNaN(totalNum) || totalNum <= 0) {
        return res.status(400).json({ success: false, message: 'Total must be greater than 0' });
      }
      updates.push('total = ?');
      params.push(totalNum);

      const diff = totalNum - tool.total;
      let newAvailable = tool.available + diff;
      if (newAvailable > totalNum) {
        newAvailable = totalNum;
      }
      if (newAvailable < 0) {
        newAvailable = 0;
      }
      updates.push('available = ?');
      params.push(newAvailable);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    db.run(`UPDATE tools SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Update failed' });
      }

      db.get('SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?', [req.params.id], (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Query failed' });
        }
        res.json({
          success: true,
          message: 'Updated successfully',
          data: row
        });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tools WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Delete failed' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Tool does not exist' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  });
});

router.post('/:id/borrow', (req, res) => {
  const { userId, borrowReason, quantity = 1 } = req.body;
  const { role } = req.user;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID cannot be empty' });
  }

  const borrowQty = parseInt(quantity) || 1;
  if (borrowQty <= 0) {
    return res.status(400).json({ success: false, message: 'Borrow quantity must be greater than 0' });
  }

  db.get('SELECT * FROM tools WHERE id = ?', [req.params.id], async (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool does not exist' });
    }

    if (tool.available < borrowQty) {
      return res.status(400).json({ success: false, message: 'Insufficient tool inventory' });
    }

    const now = new Date();

    // Admins (super_admin, dept_admin) can borrow directly without approval
    if (role === 'super_admin' || role === 'dept_admin') {
      const newAvailable = tool.available - borrowQty;
      const id = 'b' + Date.now();

      try {
        await runTransaction([
          { sql: 'UPDATE tools SET available = ? WHERE id = ? AND available >= ?', params: [newAvailable, req.params.id, borrowQty] },
          {
            sql: 'INSERT INTO borrow_records (id, tool_id, tool_name, tool_category, user_id, borrow_date, borrow_time, status, borrow_reason, quantity, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            params: [id, tool.id, tool.name, tool.category, userId, now.toISOString().split('T')[0], now.toTimeString().slice(0, 8), 'borrowed', borrowReason || '', borrowQty, tool.department_id]
          }
        ]);

        db.get('SELECT * FROM borrow_records WHERE id = ?', [id], (err, record) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Internal server error' });
          }
          res.json({ success: true, message: 'Borrow successful', data: record });
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Borrow failed, please retry' });
      }
    } else {
      // Regular users need approval
      const id = 'p' + Date.now();

      try {
        db.run(
          'INSERT INTO pending_borrows (id, tool_id, tool_name, tool_category, user_id, quantity, borrow_reason, department_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, tool.id, tool.name, tool.category, userId, borrowQty, borrowReason || '', tool.department_id, 'pending', now.toISOString(), now.toISOString()],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to submit request, please retry' });
            }
            res.json({
              success: true,
              message: 'Borrow request submitted, please wait for approval',
              status: 'pending',
              data: {
                id,
                toolId: tool.id,
                toolName: tool.name,
                toolCategory: tool.category,
                userId,
                quantity: borrowQty,
                borrowReason: borrowReason || '',
                status: 'pending',
                createdAt: now.toISOString()
              }
            });
          }
        );
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to submit request, please retry' });
      }
    }
  });
});

// Approve a pending borrow request
router.post('/pending-borrows/:id/approve', (req, res) => {
  const { approvingUserId } = req.body;
  const { role, departmentId } = req.user;

  db.get('SELECT * FROM pending_borrows WHERE id = ?', [req.params.id], async (err, pending) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!pending) {
      return res.status(404).json({ success: false, message: 'Request does not exist' });
    }

    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has been processed' });
    }

    // Permission check: only dept_admin and super_admin can approve
    if (role === 'member') {
      return res.status(403).json({ success: false, message: 'Regular users cannot approve borrow requests' });
    }

    // Dept admin can only approve requests in their department
    if (role === 'dept_admin' && pending.department_id !== departmentId) {
      return res.status(403).json({ success: false, message: 'Cannot approve requests from other departments' });
    }

    db.get('SELECT * FROM tools WHERE id = ?', [pending.tool_id], async (err, tool) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (!tool) {
        return res.status(404).json({ success: false, message: 'Tool does not exist' });
      }

      if (tool.available < pending.quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient tool inventory, cannot approve' });
      }

      const now = new Date();
      const newAvailable = tool.available - pending.quantity;
      const borrowId = 'b' + Date.now();

      try {
        await runTransaction([
          { sql: 'UPDATE tools SET available = ? WHERE id = ?', params: [newAvailable, tool.id] },
          {
            sql: 'INSERT INTO borrow_records (id, tool_id, tool_name, tool_category, user_id, borrow_date, borrow_time, status, borrow_reason, quantity, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            params: [borrowId, tool.id, tool.name, tool.category, pending.user_id, now.toISOString().split('T')[0], now.toTimeString().slice(0, 8), 'borrowed', pending.borrow_reason || '', pending.quantity, pending.department_id]
          },
          { sql: 'UPDATE pending_borrows SET status = ?, updated_at = ? WHERE id = ?', params: ['approved', now.toISOString(), req.params.id] }
        ]);

        db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId], (err, record) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Internal server error' });
          }
          res.json({ success: true, message: 'Approval successful', data: record });
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Approval failed, please retry' });
      }
    });
  });
});

// Reject a pending borrow request
router.post('/pending-borrows/:id/reject', (req, res) => {
  const { role, departmentId } = req.user;

  db.get('SELECT * FROM pending_borrows WHERE id = ?', [req.params.id], async (err, pending) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!pending) {
      return res.status(404).json({ success: false, message: 'Request does not exist' });
    }

    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has been processed' });
    }

    if (role === 'member') {
      return res.status(403).json({ success: false, message: 'Regular users cannot reject borrow requests' });
    }

    if (role === 'dept_admin' && pending.department_id !== departmentId) {
      return res.status(403).json({ success: false, message: 'Cannot reject requests from other departments' });
    }

    const now = new Date();

    db.run(
      'UPDATE pending_borrows SET status = ?, updated_at = ? WHERE id = ?',
      ['rejected', now.toISOString(), req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Operation failed' });
        }
        res.json({ success: true, message: 'Borrow request rejected' });
      }
    );
  });
});

// Cancel a pending borrow request (for regular users)
router.delete('/pending-borrows/:id', (req, res) => {
  const { userId, role } = req.user;

  db.get('SELECT * FROM pending_borrows WHERE id = ?', [req.params.id], (err, pending) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!pending) {
      return res.status(404).json({ success: false, message: 'Request does not exist' });
    }

    // Only the requester or admins can cancel
    if (role === 'member' && pending.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Cannot cancel other users borrow requests' });
    }

    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has been processed, cannot cancel' });
    }

    db.run(
      'UPDATE pending_borrows SET status = ?, updated_at = ? WHERE id = ?',
      ['cancelled', new Date().toISOString(), req.params.id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Cancel failed' });
        }
        res.json({ success: true, message: 'Borrow request cancelled' });
      }
    );
  });
});

router.post('/:id/return', (req, res) => {
  db.get('SELECT * FROM tools WHERE id = ?', [req.params.id], async (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool does not exist' });
    }

    if (tool.available >= tool.total) {
      return res.status(400).json({ success: false, message: 'All tools have been returned' });
    }

    db.get('SELECT * FROM borrow_records WHERE tool_id = ? AND status = "borrowed" ORDER BY borrow_date ASC, borrow_time ASC LIMIT 1', [req.params.id], async (err, record) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (!record) {
        return res.status(404).json({ success: false, message: 'No borrow record found' });
      }

      const newAvailable = tool.available + 1;
      const now = new Date();

      try {
        await runTransaction([
          { sql: 'UPDATE tools SET available = ? WHERE id = ? AND available < total', params: [newAvailable, req.params.id] },
          {
            sql: 'UPDATE borrow_records SET status = ?, return_date = ?, return_time = ? WHERE id = ?',
            params: ['returned', now.toISOString().split('T')[0], now.toTimeString().slice(0, 8), record.id]
          }
        ]);

        db.get('SELECT * FROM borrow_records WHERE id = ?', [record.id], (err, updatedRecord) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Internal server error' });
          }
          res.json({ success: true, message: 'Return successful', data: updatedRecord });
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Return failed, please retry' });
      }
    });
  });
});

module.exports = router;
