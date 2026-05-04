#!/bin/bash

# Tool Management System Control Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default ports
FRONTEND_PORT=${1:-3001}
BACKEND_PORT=${2:-8080}

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/server"

show_status() {
    echo -e "${GREEN}Tool Management System${NC}"
    echo "=================="
    
    if pgrep -f "vite.*$FRONTEND_PORT" > /dev/null 2>&1; then
        echo -e "Frontend: ${GREEN}Running${NC} (Port $FRONTEND_PORT)"
    else
        echo -e "Frontend: ${RED}Stopped${NC}"
    fi
    
    if pgrep -f "node.*app.js" > /dev/null 2>&1; then
        echo -e "Backend: ${GREEN}Running${NC} (Port $BACKEND_PORT)"
    else
        echo -e "Backend: ${RED}Stopped${NC}"
    fi
}

start() {
    echo -e "${GREEN}Starting Tool Management System...${NC}"
    
    cd "$BACKEND_DIR" && nohup node app.js > backend.log 2>&1 &
    echo -e "Backend started on port $BACKEND_PORT"
    
    cd "$FRONTEND_DIR" && nohup npm run dev -- --port $FRONTEND_PORT > frontend.log 2>&1 &
    echo -e "Frontend started on port $FRONTEND_PORT"
    
    sleep 2
    show_status
}

stop() {
    echo -e "${YELLOW}Stopping Tool Management System...${NC}"
    pkill -f "vite.*$FRONTEND_PORT" 2>/dev/null
    pkill -f "node.*app.js" 2>/dev/null
    echo -e "${GREEN}Stopped${NC}"
}

restart() {
    stop
    sleep 1
    start
}

status() {
    show_status
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status} [frontend_port] [backend_port]"
        exit 1
        ;;
esac