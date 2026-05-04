# Tool Management System

A full-stack application for managing tool borrowing/returning.

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
- Three role route guards: `PrivateRoute`, `AdminRoute`, `SuperAdminRoute`

### Backend (Express + SQLite)
- JWT authentication with token_version for SSO
- `/api/auth` routes are public, others require `authenticateToken` middleware

## User Roles

| Role | Visible Menu |
|------|---------------|
| `user` | Borrow/Return, User Center |
| `dept_admin` | +User management, Tool management (dept only) |
| `super_admin` | +Department management, Category management (all data) |