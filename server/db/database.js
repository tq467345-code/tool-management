const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tool_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      department_id TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      token_version INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )`);

    // Add token_version field if not exists - SQLite needs manual check
    db.all("PRAGMA table_info(users)", (err, rows) => {
      if (!err && rows && rows.length > 0) {
        const hasTokenVersion = rows.some(row => row.name === 'token_version');
        if (!hasTokenVersion) {
          db.run("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.log('token_version column may already exist (ignoring):', alterErr.message);
            }
          });
        }
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      department_id TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      description TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      CONSTRAINT valid_inventory CHECK (available >= 0 AND available <= total)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_category TEXT NOT NULL,
      user_id TEXT NOT NULL,
      borrow_date TEXT NOT NULL,
      borrow_time TEXT NOT NULL,
      return_date TEXT,
      return_time TEXT,
      status TEXT NOT NULL DEFAULT 'borrowed',
      borrow_reason TEXT,
      department_id TEXT NOT NULL,
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_tool_status ON borrow_records(tool_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_user ON borrow_records(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_department ON borrow_records(department_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tools_department ON tools(department_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id)`);
  });

  insertInitialData();
};

const insertInitialData = () => {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users:', err);
      return;
    }
    if (!row || row.count === 0) {
      const bcrypt = require('bcryptjs');
      // Use environment variable or generate random password for initial admin
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || generateRandomPassword(16);
      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      const stmt = db.prepare('INSERT INTO users (id, username, password, real_name, department_id, role) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(['admin', 'admin', hashedPassword, 'System Admin', null, 'super_admin']);
      stmt.finalize();

      // Log initial credentials only in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Initial admin credentials created:');
        console.log(`  Username: admin`);
        console.log(`  Password: ${adminPassword}`);
      } else {
        console.log('Initial admin account created. Set ADMIN_INITIAL_PASSWORD env var for production.');
      }
    }
  });
};

function generateRandomPassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const runTransaction = (operations) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          return reject(err);
        }

        let completed = 0;
        let errorOccurred = false;

        const executeNext = () => {
          if (errorOccurred) return;
          if (completed >= operations.length) {
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
              } else {
                resolve();
              }
            });
            return;
          }

          const operation = operations[completed];
          completed++;

          db.run(operation.sql, operation.params, (err) => {
            if (err) {
              errorOccurred = true;
              db.run('ROLLBACK', () => {
                reject(err);
              });
            } else {
              executeNext();
            }
          });
        };

        executeNext();
      });
    });
  });
};

module.exports = {
  db,
  initDatabase,
  runTransaction
};