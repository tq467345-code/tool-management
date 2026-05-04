# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
./toolctl.sh start [frontend_port] [backend_port]   # Default 3001 / 8080
./toolctl.sh stop
./toolctl.sh restart
./toolctl.sh status
```

Default super admin: `admin` / `admin123`

## Tech Architecture

### Frontend (React + Vite)
- Routes: `/login` → `/borrow` (regular users), `/user-center`
- Admin routes: `/tools`, `/users`, `/categories`, `/departments`
- Three role route guards: `PrivateRoute` (logged in), `AdminRoute` (dept_admin/super_admin), `SuperAdminRoute` (super_admin only)

### Backend (Express + SQLite)
- JWT authentication with token_version for SSO
- `/api/auth` routes are public, others require `authenticateToken` middleware
- Frontend calls `/api/auth/validate` every 5 seconds to check token validity


### Important Constraint
**Express Route Order**: Specific paths must come before parameterized routes
```javascript
// Correct: /export before /:id
router.get('/export', ...);
router.get('/:id', ...);
```
Affected files: `routes/tools.js`, `routes/users.js`, `routes/categories.js`

## User Roles

| Role | Visible Menu |
|------|---------------|
| `user` | Borrow/Return, User Center |
| `dept_admin` | +User management, Tool management (dept only) |
| `super_admin` | +Department management, Category management (all data) |


## Database Tables

`departments` | `users` (with role) | `tool_categories` | `tools` | `borrow_records` | `pending_borrows`

## API Export Validation

Export endpoints return 404 `{ success: false, message: "No data to export" }` when no data, and `api.js` checks and displays the error to users.