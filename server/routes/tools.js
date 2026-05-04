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
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    res.json({ success: true, data: rows || [] });
  });
});

router.get('/:id', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?';
  let params = [req.params.id];

  if (role === 'dept_admin' || role === 'member') {
    query += ' AND t.department_id = ?';
    params.push(departmentId);
  }

  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/', (req, res) => {
  const { role, departmentId } = req.user;
  const { name, category, total, location, description } = req.body;

  if (!name || !category) {
    return res.status(400).json({ success: false, message: 'Name and category are required' });
  }

  if (!total || total <= 0) {
    return res.status(400).json({ success: false, message: 'Total must be a positive number' });
  }

  let finalDepartmentId = departmentId;
  if (role === 'super_admin' && req.body.department_id) {
    finalDepartmentId = req.body.department_id;
  }

  if (!finalDepartmentId) {
    return res.status(400).json({ success: false, message: 'Department is required' });
  }

  const id = 't' + Date.now();

  db.run(
    'INSERT INTO tools (id, name, category, department_id, total, available, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, finalDepartmentId, total, total, location || '', description || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'Tool name already exists in this department' });
        }
        return res.status(500).json({ success: false, message: 'Failed to create tool' });
      }
      res.json({ success: true, data: { id, name, category, department_id: finalDepartmentId, total, available: total, location: location || '', description: description || '' } });
    }
  );
});

router.put('/:id', (req, res) => {
  const { role, departmentId } = req.user;
  const { name, category, total, available, location, description } = req.body;

  db.get('SELECT * FROM tools WHERE id = ?', [req.params.id], (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    if ((role === 'dept_admin' || role === 'member') && tool.department_id !== departmentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (total !== undefined) { updates.push('total = ?'); params.push(total); }
    if (available !== undefined) { updates.push('available = ?'); params.push(available); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    const operations = [];
    operations.push({
      sql: `UPDATE tools SET ${updates.join(', ')} WHERE id = ?`,
      params
    });

    if (name || category) {
      const setClauses = [];
      const updateParams = [];

      if (name) {
        setClauses.push('tool_name = ?');
        updateParams.push(name);
      }
      if (category) {
        setClauses.push('tool_category = ?');
        updateParams.push(category);
      }

      operations.push({
        sql: `UPDATE borrow_records SET ${setClauses.join(', ')} WHERE tool_id = ? AND status IN ('borrowed', 'approved')`,
        params: [...updateParams, req.params.id]
      });
      operations.push({
        sql: `UPDATE pending_borrows SET ${setClauses.join(', ')} WHERE tool_id = ? AND status = 'pending'`,
        params: [...updateParams, req.params.id]
      });
    }

    runTransaction(operations)
      .then(() => {
        res.json({ success: true, message: 'Tool updated successfully' });
      })
      .catch((err) => {
        res.status(500).json({ success: false, message: 'Failed to update tool' });
      });
  });
});

router.delete('/:id', (req, res) => {
  const { role, departmentId } = req.user;

  db.get('SELECT * FROM tools WHERE id = ?', [req.params.id], (err, tool) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!tool) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    if ((role === 'dept_admin' || role === 'member') && tool.department_id !== departmentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    db.get('SELECT COUNT(*) as count FROM borrow_records WHERE tool_id = ? AND status = ?', [req.params.id, 'borrowed'], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database query failed' });
      }
      if (row && row.count > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete tool with unreturned borrow records' });
      }

      db.get('SELECT COUNT(*) as count FROM pending_borrows WHERE tool_id = ? AND status = ?', [req.params.id, 'pending'], (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database query failed' });
        }
        if (row && row.count > 0) {
          return res.status(400).json({ success: false, message: 'Cannot delete tool with pending borrow requests' });
        }

        db.run('DELETE FROM tools WHERE id = ?', [req.params.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete tool' });
          }
          res.json({ success: true, message: 'Tool deleted successfully' });
        });
      });
    });
  });
});

router.get('/department/:departmentId', (req, res) => {
  const { role, departmentId: userDeptId } = req.user;
  const { departmentId } = req.params;

  if ((role === 'dept_admin' || role === 'member') && departmentId !== userDeptId) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  db.all('SELECT * FROM tools WHERE department_id = ?', [departmentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    res.json({ success: true, data: rows || [] });
  });
});

router.post('/import', (req, res) => {
  const { role, departmentId } = req.user;
  const { tools } = req.body;

  if (!tools || !Array.isArray(tools)) {
    return res.status(400).json({ success: false, message: 'Invalid import data' });
  }

  const successCount = { value: 0 };
  const failCount = { value: 0 };
  const errors = [];

  const processTools = (index) => {
    if (index >= tools.length) {
      return res.json({
        success: true,
        message: `Import completed: ${successCount.value} succeeded, ${failCount.value} failed`,
        errors: errors.slice(0, 10)
      });
    }

    const toolData = tools[index];

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

router.get('/export', (req, res) => {
  const { role, departmentId } = req.user;

  let query = 'SELECT t.*, d.name as departmentName FROM tools t LEFT JOIN departments d ON t.department_id = d.id';
  let params = [];

  if (role === 'dept_admin' || role === 'member') {
    query += ' WHERE t.department_id = ?';
    params.push(departmentId);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }

    const excelData = rows.map(tool => ({
      'Tool Name': tool.name,
      'Category': tool.category,
      'Department': tool.departmentName || '',
      'Total': tool.total,
      'Available': tool.available,
      'Location': tool.location || '',
      'Description': tool.description || ''
    }));

    res.json({ success: true, data: excelData });
  });
});

module.exports = router;
