# tool-management

Tool Management System - A full-stack application for managing tool borrowing and returning.

## Quick Start

### Linux/macOS
```bash
./toolctl.sh start [frontend_port] [backend_port]   # Default 3001 / 8080
./toolctl.sh stop
./toolctl.sh restart
./toolctl.sh status
```

### Windows
```bat
toolctl.bat start [frontend_port] [backend_port]
```

After starting, visit:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8080/api

### Login

Default super admin: `admin` / `admin123`

## Tech Stack

### Frontend
- React 18 + Vite
- Ant Design 5
- React Router 6

### Backend
- Express.js
- SQLite
- JWT Authentication
- bcryptjs

## Project Structure

```
tool-management/
├── toolctl.sh              # Start/stop script (Linux/macOS)
├── toolctl.bat             # Start/stop script (Windows)
├── CLAUDE.md               # Claude Code development guide
├── README.md               # This file
├── server/                 # Backend
│   ├── app.js              # Express entry point
│   ├── config.js           # Configuration
│   ├── db/
│   │   └── database.js     # SQLite database initialization
│   ├── middleware/
│   │   └── auth.js         # JWT authentication middleware
│   └── routes/
│       ├── auth.js         # Authentication routes
│       ├── tools.js        # Tool management routes
│       ├── users.js        # User management routes
│       ├── categories.js   # Category management routes
│       ├── departments.js  # Department management routes
│       └── borrows.js      # Borrow records routes
├── frontend/               # Frontend application
│   ├── src/
│   │   ├── App.jsx         # React root component
│   │   ├── pages/          # Page components
│   │   ├── components/     # Shared components
│   │   └── services/
│   │       └── api.js      # API request wrapper
│   └── tests/              # Playwright E2E tests
└── scripts/                # Utility scripts
```

## Role Permissions

| Role | Visible Menu | Permissions |
|------|--------------|-------------|
| Regular User | Borrow/Return tools, User Center | Borrow tools, view records, change password |
| Dept Admin | +User management, Tool management | Manage dept users/tools, approve requests |
| Super Admin | +Department management, Category management | Manage all data, manage departments |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/validate` - Real-time token validation

### Tool Management
- `GET /api/tools` - Get tool list
- `POST /api/tools` - Add tool
- `PUT /api/tools/:id` - Update tool
- `DELETE /api/tools/:id` - Delete tool
- `POST /api/tools/:id/borrow` - Borrow tool
- `POST /api/tools/:id/return` - Return tool
- `GET /api/tools/pending-borrows` - Get pending requests
- `POST /api/tools/pending-borrows/:id/approve` - Approve request
- `POST /api/tools/pending-borrows/:id/reject` - Reject request

### User Management
- `GET /api/users` - Get user list
- `POST /api/users` - Add user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/reset-password` - Reset password
- `PUT /api/users/:id/status` - Enable/disable account

### Categories
- `GET /api/categories` - Get category list
- `POST /api/categories` - Add category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Departments
- `GET /api/departments` - Get department list
- `POST /api/departments` - Add department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department

### Borrow Records
- `GET /api/borrows` - Get borrow records
- `POST /api/borrows` - Create borrow record
- `PUT /api/borrows/:id/return` - Return tool

## Database Tables

| Table | Description |
|-------|-------------|
| departments | Department/team table |
| users | User table (with role: super_admin/dept_admin/user) |
| tool_categories | Tool category table |
| tools | Tool inventory table |
| borrow_records | Borrow records table |
| pending_borrows | Pending borrow requests table |

## License

MIT