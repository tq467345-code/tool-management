#!/bin/bash
# ============================================
# 工具管理系统 - 启动/停止脚本 (Linux/macOS)
# 用法：
#   ./toolctl.sh start [前端端口] [后端端口]  - 启动服务
#   ./toolctl.sh stop                          - 停止服务
#   ./toolctl.sh restart [前端端口] [后端端口] - 重启服务
#   ./toolctl.sh status                        - 查看服务状态
#   ./toolctl.sh reset                         - 重置数据库（清空所有数据，仅保留admin账号）
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 默认端口
FRONTEND_PORT=${2:-3001}
BACKEND_PORT=${3:-8080}

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# 服务端口
BACKEND_PORT_START=${1:-$BACKEND_PORT}

# ============================================
# 跨平台检测端口占用函数
# ============================================
is_port_in_use() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -i :$port &> /dev/null
    elif command -v ss &> /dev/null; then
        ss -tuln 2>/dev/null | grep -q ":$port "
    elif command -v netstat &> /dev/null; then
        netstat -tuln 2>/dev/null | grep -q ":$port "
    else
        timeout 1 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null
    fi
    return $?
}

get_port_pid() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -ti :$port 2>/dev/null | head -1
    elif command -v ss &> /dev/null; then
        ss -tulnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1
    elif command -v netstat &> /dev/null; then
        netstat -tulnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1
    fi
}

# ============================================
# 检查 Node.js 环境
# ============================================
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误：未安装 Node.js${NC}"
        echo "请访问 https://nodejs.org 安装 Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}错误：Node.js 版本必须 >= 18.0.0${NC}"
        echo "当前版本：$(node -v 2>/dev/null || echo '未知')${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js 版本：$(node -v)${NC}"
}

# ============================================
# 安装依赖
# ============================================
install_deps() {
    echo ""
    echo -e "${YELLOW}正在检查和安装依赖...${NC}"

    if [ ! -d "server/data" ]; then
        mkdir -p server/data
    fi

    if [ -f "server/package.json" ]; then
        if [ ! -d "server/node_modules" ]; then
            echo "  正在安装后端依赖..."
            cd server && npm install 2>&1 | tail -10
            cd ..
        fi
    fi

    if [ -f "frontend/package.json" ]; then
        if [ ! -d "frontend/node_modules" ]; then
            echo "  正在安装前端依赖..."
            cd frontend && npm install 2>&1 | tail -10
            cd ..
        fi
    fi

    if [ -f "perf-test/package.json" ]; then
        if [ ! -d "perf-test/node_modules" ]; then
            echo "  正在安装性能测试依赖..."
            cd perf-test && npm install 2>&1 | tail -5
            cd ..
        fi
    fi

    echo -e "${GREEN}✓ 依赖检查完成${NC}"
}

# ============================================
# 停止服务
# ============================================
stop_services() {
    echo -e "${YELLOW}正在停止服务...${NC}"

    if [ -f "server/.backend.pid" ]; then
        BACKEND_PID=$(cat server/.backend.pid 2>/dev/null || echo "")
        if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID &> /dev/null; then
            kill $BACKEND_PID 2>/dev/null || true
        fi
        rm -f server/.backend.pid
    fi

    local backend_pid=$(get_port_pid $BACKEND_PORT)
    if [ -n "$backend_pid" ]; then
        kill -9 $backend_pid 2>/dev/null || true
    fi

    if [ -f "frontend/.frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend/.frontend.pid 2>/dev/null || echo "")
        if [ -n "$FRONTEND_PID" ] && ps -p $FRONTEND_PID &> /dev/null; then
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        rm -f frontend/.frontend.pid
    fi

    local frontend_pid=$(get_port_pid $FRONTEND_PORT)
    if [ -n "$frontend_pid" ]; then
        kill -9 $frontend_pid 2>/dev/null || true
    fi

    sleep 1
    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# ============================================
# 重置数据库
# ============================================
reset_database() {
    echo ""
    echo -e "${YELLOW}正在重置数据库...${NC}"

    stop_services

    if [ -f "server/data/database.db" ]; then
        rm -f server/data/database.db
        echo -e "${GREEN}✓ 已删除数据库文件${NC}"
    fi

    echo -e "${YELLOW}正在重新初始化数据库...${NC}"
    cd server
    export PORT=$BACKEND_PORT
    node -e "
        const { initDatabase } = require('./db/database');
        initDatabase();
        console.log('✓ 数据库初始化完成');
    "
    cd ..

    echo -e "${GREEN}✓ 数据库重置完成${NC}"
    echo -e "${CYAN}提示：默认超级管理员账号为 admin / admin123${NC}"
}

# ============================================
# 检查端口可用性
# ============================================
check_ports() {
    if is_port_in_use $FRONTEND_PORT; then
        echo -e "${RED}错误：前端端口 $FRONTEND_PORT 已被占用${NC}"
        local pid=$(get_port_pid $FRONTEND_PORT)
        [ -n "$pid" ] && echo "  占用进程 PID: $pid"
        return 1
    fi

    if is_port_in_use $BACKEND_PORT; then
        echo -e "${RED}错误：后端端口 $BACKEND_PORT 已被占用${NC}"
        local pid=$(get_port_pid $BACKEND_PORT)
        [ -n "$pid" ] && echo "  占用进程 PID: $pid"
        return 1
    fi

    echo -e "${GREEN}✓ 端口检查通过${NC}"
    return 0
}

# ============================================
# 启动服务
# ============================================
start_services() {
    echo ""
    echo "==========================================="
    echo "  工具管理系统 - 启动服务"
    echo "==========================================="
    echo "配置："
    echo "  前端端口：$FRONTEND_PORT"
    echo "  后端端口：$BACKEND_PORT"
    echo ""

    stop_services
    check_ports || exit 1

    echo -e "${YELLOW}正在启动后端服务...${NC}"
    cd server
    export PORT=$BACKEND_PORT
    nohup node app.js > server.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid

    local waited=0
    while [ $waited -lt 30 ]; do
        curl -s --connect-timeout 2 http://localhost:$BACKEND_PORT/api/auth/login > /dev/null 2>&1 && break
        sleep 1
        waited=$((waited + 1))
    done

    if curl -s --connect-timeout 3 http://localhost:$BACKEND_PORT/api/auth/login > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务已启动（PID: $BACKEND_PID）${NC}"
    else
        echo -e "${RED}✗ 后端服务启动失败${NC}"
        echo "后端日志："
        tail -20 server.log 2>/dev/null || echo "无法读取日志"
        exit 1
    fi

    cd ..

    echo -e "${YELLOW}正在启动前端服务...${NC}"
    cd frontend
    export VITE_PORT=$FRONTEND_PORT
    export VITE_API_URL=http://localhost:$BACKEND_PORT/api
    nohup npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid

    waited=0
    while [ $waited -lt 60 ]; do
        curl -s --connect-timeout 2 http://localhost:$FRONTEND_PORT > /dev/null 2>&1 && break
        sleep 2
        waited=$((waited + 2))
    done

    if curl -s --connect-timeout 3 http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 前端服务已启动（PID: $FRONTEND_PID）${NC}"
    else
        echo -e "${RED}✗ 前端服务启动失败${NC}"
        echo "前端日志："
        tail -20 frontend.log 2>/dev/null || echo "无法读取日志"
        exit 1
    fi

    cd ..

    echo ""
    echo "==========================================="
    echo -e "${GREEN}  服务启动成功！${NC}"
    echo "==========================================="
    echo ""
    echo "  访问地址："
    echo "    前端：http://localhost:$FRONTEND_PORT"
    echo "    后端：http://localhost:$BACKEND_PORT/api"
    echo ""
    echo "  超级管理员账号：admin / admin123"
    echo ""
    echo "  查看日志："
    echo "    后端：tail -f server/server.log"
    echo "    前端：tail -f frontend/frontend.log"
    echo ""
}

# ============================================
# 查看状态
# ============================================
status_services() {
    echo ""
    echo "==========================================="
    echo "  服务状态"
    echo "==========================================="

    if curl -s --connect-timeout 3 http://localhost:$BACKEND_PORT/api/auth/login > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务：运行中（端口 $BACKEND_PORT）${NC}"
    else
        echo -e "${RED}✗ 后端服务：未运行（端口 $BACKEND_PORT）${NC}"
    fi

    if curl -s --connect-timeout 3 http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 前端服务：运行中（端口 $FRONTEND_PORT）${NC}"
    else
        echo -e "${RED}✗ 前端服务：未运行（端口 $FRONTEND_PORT）${NC}"
    fi
    echo ""
}

# ============================================
# 主逻辑
# ============================================
case "$1" in
    start|restart)
        check_node
        install_deps
        start_services
        ;;
    stop)
        check_node
        stop_services
        ;;
    status)
        status_services
        ;;
    reset)
        check_node
        install_deps
        reset_database
        ;;
    *)
        echo ""
        echo "工具管理系统 - 启动/停止脚本"
        echo ""
        echo "用法："
        echo "  $0 start [前端端口] [后端端口]  启动服务（默认 3001 8080）"
        echo "  $0 stop                          停止服务"
        echo "  $0 restart [前端端口] [后端端口]  重启服务"
        echo "  $0 status                        查看服务状态"
        echo "  $0 reset                         重置数据库"
        echo ""
        exit 1
        ;;
esac
