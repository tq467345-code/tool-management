const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET all departments
router.get('/', (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    res.json(rows);
  });
});

// GET single department by id
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM departments WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Department does not exist' });
    }
    res.json(row);
  });
});

// POST create department
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Department name cannot be empty' });
  }

  const id = 'd' + Date.now();

  db.run('INSERT INTO departments (id, name) VALUES (?, ?)', [id, name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: 'Department name already exists' });
      }
      return res.status(500).json({ success: false, message: 'Create failed' });
    }
    res.json({ success: true, message: 'Created successfully', data: { id, name } });
  });
});

// PUT update department
router.put('/:id', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Department name cannot be empty' });
  }

  db.run('UPDATE departments SET name = ? WHERE id = ?', [name, req.params.id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: 'Department name already exists' });
      }
      return res.status(500).json({ success: false, message: 'Update failed' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Department does not exist' });
    }
    res.json({ success: true, message: 'Updated successfully', data: { id: req.params.id, name } });
  });
});

// DELETE department
router.delete('/:id', (req, res) => {
  // Check if there are users in this department
  db.get('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (row && row.count > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete department with users' });
    }

    // Check if there are tools in this department
    db.get('SELECT COUNT(*) as count FROM tools WHERE department_id = ?', [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database query failed' });
      }
      if (row && row.count > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete department with tools' });
      }

      db.run('DELETE FROM departments WHERE id = ?', [req.params.id], function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Delete failed' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: 'Department does not exist' });
        }
        res.json({ success: true, message: 'Deleted successfully' });
      });
    });
  });
});

module.exports = router;