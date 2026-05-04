const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT * FROM tool_categories', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }
    res.json(rows);
  });
});

router.get('/export', (req, res) => {
  db.all('SELECT name FROM tool_categories', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
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
    return res.status(400).json({ success: false, message: 'Import data must be array format' });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  importedCategories.forEach((catData, index) => {
    try {
      if (!catData['Category Name']) {
        failCount++;
        errors.push(`Row ${index + 1}: Category Name is required`);
        return;
      }

      const id = 'c' + Date.now() + index;

      db.run(
        'INSERT OR IGNORE INTO tool_categories (id, name) VALUES (?, ?)',
        [id, catData['Category Name']],
        function(err) {
          if (err) {
            failCount++;
            errors.push(`Row ${index + 1}: Import failed - ${err.message}`);
          } else if (this.changes > 0) {
            successCount++;
          } else {
            failCount++;
            errors.push(`Row ${index + 1}: Category already exists`);
          }
        }
      );
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

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM tool_categories WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query failed' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'Category does not exist' });
    }

    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
  }

  const id = 'c' + Date.now();

  db.run(
    'INSERT INTO tool_categories (id, name) VALUES (?, ?)',
    [id, name],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Insert failed' });
      }

      res.json({
        success: true,
        message: 'Created successfully',
        data: { id, name }
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
  }

  db.run('UPDATE tool_categories SET name = ? WHERE id = ?', [name, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Update failed' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Category does not exist' });
    }

    res.json({
      success: true,
      message: 'Updated successfully',
      data: { id: req.params.id, name }
    });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tool_categories WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Delete failed' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Category does not exist' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  });
});

module.exports = router;
