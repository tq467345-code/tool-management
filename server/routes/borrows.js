const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET all borrow records
router.get('/', (req, res) => {
  const { role, departmentId, userId } = req.user;

  let query;
  let params = [];

  if (role === 'super_admin') {
    query = `
      SELECT br.*, t.name as toolName, u.real_name as borrowerName, d.name as departmentName
      FROM borrow_records br
      LEFT JOIN tools t ON br.tool_id = t.id
      LEFT JOIN users u ON br.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      ORDER BY br.borrow_date DESC
    `;
  } else if (role === 'dept_admin') {
    query = `
      SELECT br.*, t.name as toolName, u.real_name as borrowerName, d.name as departmentName
      FROM borrow_records br
      LEFT JOIN tools t ON br.tool_id = t.id
      LEFT JOIN users u ON br.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.department_id = ?
      ORDER BY br.borrow_date DESC
    `;
    params = [departmentId];
  } else {
    query = `
      SELECT br.*, t.name as toolName, u.real_name as borrowerName, d.name as departmentName
      FROM borrow_records br
      LEFT JOIN tools t ON br.tool_id = t.id
      LEFT JOIN users u ON br.user_id = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE br.user_id = ?
      ORDER BY br.borrow_date DESC
    `;
    params = [userId];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    res.json(rows);
  });
});

// GET borrow record by id
router.get('/:id', (req, res) => {
  const { role, departmentId } = req.user;

  db.get(`
    SELECT br.*, t.name as toolName, u.real_name as borrowerName, d.name as departmentName
    FROM borrow_records br
    LEFT JOIN tools t ON br.tool_id = t.id
    LEFT JOIN users u ON br.user_id = u.id
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE br.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (role === 'dept_admin' && row.department_id !== departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json(row);
  });
});

// POST create borrow record (borrow tool)
router.post('/', (req, res) => {
  const { toolId, quantity } = req.body;
  const userId = req.user.userId;

  if (!toolId || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Tool ID and quantity are required' });
  }

  db.get('SELECT * FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }
    if (tool.available_quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient available quantity' });
    }

    db.run(
      'UPDATE tools SET available_quantity = available_quantity - ? WHERE id = ?',
      [quantity, toolId],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Update tool quantity failed' });
        }

        const id = 'br' + Date.now();
        const borrowDate = new Date().toISOString();

        db.run(
          'INSERT INTO borrow_records (id, tool_id, user_id, quantity, borrow_date, status) VALUES (?, ?, ?, ?, ?, ?)',
          [id, toolId, userId, quantity, borrowDate, 'borrowed'],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Create borrow record failed' });
            }
            res.json({
              success: true,
              message: 'Borrow request submitted successfully',
              data: { id, tool_id: toolId, user_id: userId, quantity, borrow_date: borrowDate, status: 'borrowed' }
            });
          }
        );
      }
    );
  });
});

// PUT update borrow record (return tool)
router.put('/:id/return', (req, res) => {
  const { condition } = req.body;
  const recordId = req.params.id;

  db.get('SELECT * FROM borrow_records WHERE id = ?', [recordId], (err, record) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (record.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Tool already returned' });
    }

    db.run('UPDATE tools SET available_quantity = available_quantity + ? WHERE id = ?', [record.quantity, record.tool_id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Update tool quantity failed' });
      }

      const returnDate = new Date().toISOString();
      db.run(
        'UPDATE borrow_records SET status = ?, return_date = ?, condition = ? WHERE id = ?',
        ['returned', returnDate, condition || '', recordId],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Return failed' });
          }
          res.json({
            success: true,
            message: 'Tool returned successfully',
            data: { id: recordId, status: 'returned', return_date: returnDate }
          });
        }
      );
    });
  });
});

// PUT approve borrow (dept_admin or super_admin)
router.put('/:id/approve', (req, res) => {
  const { role, departmentId } = req.user;
  const recordId = req.params.id;

  if (role === 'user') {
    return res.status(403).json({ success: false, message: 'Regular users cannot approve borrow requests' });
  }

  db.get('SELECT * FROM borrow_records WHERE id = ?', [recordId], (err, record) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    if (record.status !== 'borrowed') {
      return res.status(400).json({ success: false, message: 'Only borrowed status can be approved' });
    }

    if (role === 'dept_admin') {
      db.get('SELECT department_id FROM tools WHERE id = ?', [record.tool_id], (err, tool) => {
        if (err || !tool || tool.department_id !== departmentId) {
          return res.status(403).json({ success: false, message: 'Cannot approve tools from other departments' });
        }
        approveBorrow(recordId);
      });
    } else {
      approveBorrow(recordId);
    }
  });

  function approveBorrow(id) {
    db.run(
      'UPDATE borrow_records SET status = ?, approve_date = ? WHERE id = ?',
      ['approved', new Date().toISOString(), id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Approve failed' });
        }
        res.json({
          success: true,
          message: 'Borrow request approved',
          data: { id, status: 'approved' }
        });
      }
    );
  }
});

// DELETE borrow record
router.delete('/:id', (req, res) => {
  const { role, departmentId, userId } = req.user;
  const recordId = req.params.id;

  if (role === 'user') {
    return res.status(403).json({ success: false, message: 'Regular users cannot delete borrow records' });
  }

  db.get('SELECT * FROM borrow_records WHERE id = ?', [recordId], (err, record) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (role === 'dept_admin') {
      db.get('SELECT department_id FROM tools WHERE id = ?', [record.tool_id], (err, tool) => {
        if (err || !tool || tool.department_id !== departmentId) {
          return res.status(403).json({ success: false, message: 'Cannot delete records of tools from other departments' });
        }
        deleteRecord(recordId, record);
      });
    } else {
      deleteRecord(recordId, record);
    }
  });

  function deleteRecord(id, record) {
    if (record.status !== 'borrowed' && record.status !== 'returned') {
      db.run('DELETE FROM borrow_records WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Delete failed' });
        }
        res.json({ success: true, message: 'Deleted successfully' });
      });
    } else {
      return res.status(400).json({ success: false, message: 'Cannot delete borrowed or approved records' });
    }
  }
});

module.exports = router;
