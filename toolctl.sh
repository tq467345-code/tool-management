#!/bin/bash
# ============================================
# Tool Management System - Start/Stop Script (Linux/macOS)
# Usage:
#   ./toolctl.sh start [frontend_port] [backend_port]  - Start services
#   ./toolctl.sh stop                          - Stop services
#   ./toolctl.sh restart [frontend_port] [backend_port] - Restart services
#   ./toolctl.sh status                        - Check service status
# ============================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default ports
FRONTEND_PORT=${2:-3001}
BACKEND_PORT=${3:-8080}

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Service ports
BACKEND_PORT_START=${1:-$BACKEND_PORT}

# ============================================
# Check Node.js environment
# ============================================
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        echo "Please visit https://nodejs.org to install Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Error: Node.js version must be >= 18.0.0${NC}"
        echo "Current version: $(node -v)"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"
}

# ============================================
# Install dependencies
# ============================================
install_deps() {
    echo ""
    echo -e "${YELLOW}Checking and installing dependencies...${NC}"

    local deps_installed=true

    # Create data directory
    if [ ! -d "server/data" ]; then
        mkdir -p server/data
    fi

    # Backend dependencies
    if [ -f "server/package.json" ]; then
        if [ ! -d "server/node_modules" ]; then
            echo "  Installing backend dependencies..."
            cd server && npm install --silent 2>&1 | tail -5
            cd ..
            deps_installed=false
        fi
    fi

    # Frontend dependencies
    if [ -f "frontend/package.json" ]; then
        if [ ! -d "frontend/node_modules" ]; then
            echo "  Installing frontend dependencies..."
            cd frontend && npm install --silent 2>&1 | tail -5
            cd ..
            deps_installed=false
        fi
    fi

    echo -e "${GREEN}✓ Dependency check complete${NC}"
}

# ============================================
# Stop services
# ============================================
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"

    # Stop backend
    if [ -f "server/.backend.pid" ]; then
        BACKEND_PID=$(cat server/.backend.pid 2>/dev/null || echo "")
        if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID &> /dev/null; then
            kill $BACKEND_PID 2>/dev/null || true
        fi
        rm -f server/.backend.pid
    fi

    # Force stop processes using backend port
    local backend_pid=$(lsof -i :$BACKEND_PORT 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1)
    if [ -n "$backend_pid" ]; then
        kill -9 $backend_pid 2>/dev/null || true
    fi

    # Stop frontend
    if [ -f "frontend/.frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend/.frontend.pid 2>/dev/null || echo "")
        if [ -n "$FRONTEND_PID" ] && ps -p $FRONTEND_PID &> /dev/null; then
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        rm -f frontend/.frontend.pid
    fi

    # Force stop processes using frontend port
    local frontend_pid=$(lsof -i :$FRONTEND_PORT 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1)
    if [ -n "$frontend_pid" ]; then
        kill -9 $frontend_pid 2>/dev/null || true
    fi

    sleep 1
    echo -e "${GREEN}✓ Services stopped${NC}"
}

# ============================================
# Start services
# ============================================
start_services() {
    echo ""
    echo "=========================================="
    echo "  Tool Management System - Start Services"
    echo "=========================================="
    echo "Configuration:"
    echo "  Frontend port: $FRONTEND_PORT"
    echo "  Backend port: $BACKEND_PORT"
    echo ""

    # Stop existing services
    stop_services

    # Start backend
    echo -e "${YELLOW}Starting backend service...${NC}"
    cd server
    export PORT=$BACKEND_PORT
    nohup node app.js > server.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid

    # Wait for backend to start
    sleep 2

    # Check backend
    if curl -s http://localhost:$BACKEND_PORT/api/auth/login > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend service started (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}✗ Backend service failed to start${NC}"
        cat server.log
        exit 1
    fi

    cd ..

    # Start frontend
    echo -e "${YELLOW}Starting frontend service...${NC}"
    cd frontend
    export VITE_PORT=$FRONTEND_PORT
    export VITE_API_URL=http://localhost:$BACKEND_PORT/api
    nohup npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid

    # Wait for frontend to start
    sleep 3

    # Check frontend
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend service started (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}✗ Frontend service failed to start${NC}"
        cat frontend.log
        exit 1
    fi

    cd ..

    echo ""
    echo "=========================================="
    echo -e "${GREEN}  Services started successfully!${NC}"
    echo "=========================================="
    echo ""
    echo "  Access URLs:"
    echo "    Frontend: http://localhost:$FRONTEND_PORT"
    echo "    Backend: http://localhost:$BACKEND_PORT/api"
    echo ""
    echo "  Super admin: admin / admin123"
    echo ""
    echo "  View logs:"
    echo "    Backend: tail -f server/server.log"
    echo "    Frontend: tail -f frontend/frontend.log"
    echo ""
}

# ============================================
# Check status
# ============================================
status_services() {
    echo ""
    echo "=========================================="
    echo "  Service Status"
    echo "=========================================="

    # Check backend
    if curl -s http://localhost:$BACKEND_PORT/api/auth/login > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend service: Running (port $BACKEND_PORT)${NC}"
    else
        echo -e "${RED}✗ Backend service: Not running (port $BACKEND_PORT)${NC}"
    fi

    # Check frontend
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend service: Running (port $FRONTEND_PORT)${NC}"
    else
        echo -e "${RED}✗ Frontend service: Not running (port $FRONTEND_PORT)${NC}"
    fi
    echo ""
}

# ============================================
# Main logic
# ============================================
case "$1" in
    start|restart)
        check_node
        install_deps
        start_services
        ;;
    stop)
        stop_services
        ;;
    status)
        status_services
        ;;
    *)
        echo ""
        echo "Tool Management System - Start/Stop Script"
        echo ""
        echo "Usage:"
        echo "  $0 start [frontend_port] [backend_port]  Start services (default 3001 8080)"
        echo "  $0 stop                         Stop services"
        echo "  $0 restart [frontend_port] [backend_port]  Restart services"
        echo "  $0 status                       Check service status"
        echo ""
        exit 1
        ;;
esac