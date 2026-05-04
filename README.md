# 工具管理系统

工具管理系统 - 用于管理工具借用和归还的全栈应用程序。

## 快速开始

### Linux/macOS
```bash
./toolctl.sh start [前端端口] [后端端口]   # 默认 3001 / 8080
./toolctl.sh stop
./toolctl.sh restart
./toolctl.sh status
./toolctl.sh reset  # 重置数据库（清空所有数据，仅保留admin账号）
```

### Windows
```bat
toolctl.bat start [前端端口] [后端端口]
```

启动后访问：
- 前端：http://localhost:3001
- 后端API：http://localhost:8080/api

### 登录

默认超级管理员账号：`admin` / `admin123`

## 技术栈

### 前端
- React 18 + Vite
- Ant Design 5
- React Router 6

### 后端
- Express.js
- SQLite
- JWT 认证
- bcryptjs

## 项目结构

```
tool-management/
├── toolctl.sh              # 启动/停止脚本 (Linux/macOS)
├── toolctl.bat             # 启动/停止脚本 (Windows)
├── CLAUDE.md               # Claude Code 开发指南
├── README.md               # 本文档
├── server/                 # 后端
│   ├── app.js              # Express 入口
│   ├── config.js           # 配置文件
│   ├── db/
│   │   └── database.js     # SQLite 数据库初始化
│   ├── middleware/
│   │   └── auth.js         # JWT 认证中间件
│   └── routes/
│       ├── auth.js         # 认证路由
│       ├── tools.js        # 工具管理路由
│       ├── users.js        # 用户管理路由
│       ├── categories.js   # 类别管理路由
│       ├── departments.js   # 班组管理路由
│       └── borrows.js      # 借用记录路由
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── App.jsx        # React 根组件
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # 共享组件
│   │   └── services/
│   │       └── api.js     # API 请求封装
│   └── tests/             # Playwright E2E 测试
├── perf-test/             # 性能测试框架 (k6)
└── scripts/                # 工具脚本
```

## 角色权限

| 角色 | 可访问菜单 | 权限 |
|------|------------|------|
| 普通用户 | 借用/归还工具、用户中心 | 借用工具、查看记录、修改密码 |
| 班组管理员 | +用户管理、工具管理 | 管理本班组用户和工具、审批申请 |
| 超级管理员 | +班组管理、类别管理 | 管理所有数据、管理班组 |

## API 接口

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/change-password` - 修改密码
- `GET /api/auth/validate` - 实时验证令牌

### 工具管理
- `GET /api/tools` - 获取工具列表
- `POST /api/tools` - 添加工具
- `PUT /api/tools/:id` - 更新工具
- `DELETE /api/tools/:id` - 删除工具（有借用中或待审批申请时不可删除）
- `POST /api/tools/:id/borrow` - 借用工具
- `POST /api/tools/:id/return` - 归还工具
- `GET /api/tools/pending-borrows` - 获取待审批申请
- `POST /api/tools/pending-borrows/:id/approve` - 批准申请
- `POST /api/tools/pending-borrows/:id/reject` - 拒绝申请

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 添加用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户
- `POST /api/users/:id/reset-password` - 重置密码
- `PUT /api/users/:id/status` - 启用/停用账号

### 类别管理
- `GET /api/categories` - 获取类别列表
- `POST /api/categories` - 添加类别
- `PUT /api/categories/:id` - 更新类别
- `DELETE /api/categories/:id` - 删除类别

### 班组管理
- `GET /api/departments` - 获取班组列表
- `POST /api/departments` - 添加班组
- `PUT /api/departments/:id` - 更新班组
- `DELETE /api/departments/:id` - 删除班组（有用户或工具时不可删除）

### 借用记录
- `GET /api/borrows` - 获取借用记录
- `POST /api/borrows` - 创建借用记录
- `PUT /api/borrows/:id/return` - 归还工具

## 数据库表

| 表名 | 说明 |
|------|------|
| departments | 班组表 |
| users | 用户表（包含角色：super_admin/dept_admin/user） |
| tool_categories | 工具类别表 |
| tools | 工具库存表 |
| borrow_records | 借用记录表 |
| pending_borrows | 待审批借用申请表 |

## 业务规则

### 工具删除保护
如果工具存在未归还的借用记录或待审批的借用申请，则不允许删除该工具。

### 工具信息同步更新
当工具的名称或类别发生变更时，系统会自动同步更新借用中和借用记录中的工具信息。

## License

MIT
