# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在此代码仓库中工作时的指导说明。

## 项目概述

工具管理系统 - 用于管理工具借用和归还的全栈应用程序。

## 快速开始

```bash
./toolctl.sh start [前端端口] [后端端口]   # 默认 3001 / 8080
./toolctl.sh stop
./toolctl.sh restart
./toolctl.sh status
./toolctl.sh reset  # 重置数据库
```

默认超级管理员账号：`admin` / `admin123`

## 技术架构

### 前端 (React + Vite)
- 路由：`/login` → `/borrow`（普通用户）、`/user-center`
- 管理员路由：`/tools`、`/users`、`/categories`、`/departments`
- 三个角色路由守卫：`PrivateRoute`（已登录）、`AdminRoute`（dept_admin/super_admin）、`SuperAdminRoute`（仅 super_admin）

### 后端 (Express + SQLite)
- JWT 认证，通过 token_version 实现单点登录（SSO）
- `/api/auth` 路由公开，其他路由需要 `authenticateToken` 中间件
- 前端每 5 秒调用 `/api/auth/validate` 检查令牌有效性

### 重要约束
**Express 路由顺序**：特定路径必须放在参数化路由之前
```javascript
// 正确：/export 在 /:id 之前
router.get('/export', ...);
router.get('/:id', ...);
```
受影响文件：`routes/tools.js`、`routes/users.js`、`routes/categories.js`

## 用户角色

| 角色 | 可访问菜单 |
|------|------------|
| `user` | 借用/归还、用户中心 |
| `dept_admin` | +用户管理、工具管理（仅本班组） |
| `super_admin` | +班组管理、类别管理（全部数据） |

## 数据库表

`departments` | `users`（包含角色） | `tool_categories` | `tools` | `borrow_records` | `pending_borrows`

## 业务规则

### 工具删除保护
如果工具存在未归还的借用记录（status='borrowed'）或待审批的借用申请（status='pending'），则不允许删除该工具。

### 工具信息同步更新
当工具的名称或类别发生变更时，系统会在同一事务中自动同步更新：
- `borrow_records` 表中借用中记录的 tool_name 和 tool_category
- `pending_borrows` 表中待审批申请的 tool_name 和 tool_category

## API 导出验证

导出接口在无数据时返回 404：`{ success: false, message: "无数据可导出" }`，前端 `api.js` 会检查并显示给用户。
