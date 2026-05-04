@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================
REM 工具管理系统 - 启动/停止脚本 (Windows)
REM 用法：
REM   toolctl.bat start [前端端口] [后端端口]  - 启动服务
REM   toolctl.bat stop                          - 停止服务
REM   toolctl.bat restart [前端端口] [后端端口] - 重启服务
REM   toolctl.bat status                        - 查看服务状态
REM   toolctl.bat reset                         - 重置数据库（清空所有数据，仅保留admin账号）
REM ============================================

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

set "FRONTEND_PORT=%1"
set "BACKEND_PORT=%2"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3001"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8080"

REM ============================================
REM Check Node.js environment
REM ============================================
where node >nul 2>&1
if errorlevel 1 (
    echo [31m错误：未安装 Node.js[0m
    echo 请访问 https://nodejs.org 安装 Node.js 18+
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VERSION_FULL=%%i"
for /f "tokens=2 delims=v" %%i in ('echo %NODE_VERSION_FULL%') do set "NODE_VERSION=%%i"
for /f "tokens=1 delims=." %%i in ('echo %NODE_VERSION%') do set "NODE_VERSION_MAJOR=%%i"

if %NODE_VERSION_MAJOR% LSS 18 (
    echo [31m错误：Node.js 版本必须 ^>= 18.0.0[0m
    echo 当前版本：%NODE_VERSION_FULL%
    exit /b 1
)
echo [32m✓ Node.js 版本：%NODE_VERSION_FULL%[0m

REM ============================================
REM Install dependencies
REM ============================================
:install_deps
echo.
echo [33m正在检查和安装依赖...[0m

if not exist "%PROJECT_ROOT%\server\data" (
    mkdir "%PROJECT_ROOT%\server\data" >nul 2>&1
)

if exist "%PROJECT_ROOT%\server\package.json" (
    if not exist "%PROJECT_ROOT%\server\node_modules" (
        echo   正在安装后端依赖...
        cd /d "%PROJECT_ROOT%\server"
        call npm install >nul 2>&1
        echo   后端依赖安装完成
    )
)

if exist "%PROJECT_ROOT%\frontend\package.json" (
    if not exist "%PROJECT_ROOT%\frontend\node_modules" (
        echo   正在安装前端依赖...
        cd /d "%PROJECT_ROOT%\frontend"
        call npm install >nul 2>&1
        echo   前端依赖安装完成
    )
)

if exist "%PROJECT_ROOT%\perf-test\package.json" (
    if not exist "%PROJECT_ROOT%\perf-test\node_modules" (
        cd /d "%PROJECT_ROOT%\perf-test"
        call npm install >nul 2>&1
    )
)

cd /d "%PROJECT_ROOT%"
echo [32m✓ 依赖检查完成[0m
goto :eof

REM ============================================
REM Stop services
REM ============================================
:stop_services
echo.
echo [33m正在停止服务...[0m

if exist "%PROJECT_ROOT%\server\.backend.pid" (
    for /f "delims=" %%a in ('type "%PROJECT_ROOT%\server\.backend.pid"') do set "BACKEND_PID=%%a"
    if not "!BACKEND_PID!"=="" (
        taskkill /F /PID !BACKEND_PID! >nul 2>&1
    )
    del "%PROJECT_ROOT%\server\.backend.pid" >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

if exist "%PROJECT_ROOT%\frontend\.frontend.pid" (
    for /f "delims=" %%a in ('type "%PROJECT_ROOT%\frontend\.frontend.pid"') do set "FRONTEND_PID=%%a"
    if not "!FRONTEND_PID!"=="" (
        taskkill /F /PID !FRONTEND_PID! >nul 2>&1
    )
    del "%PROJECT_ROOT%\frontend\.frontend.pid" >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 >nul
echo [32m✓ 服务已停止[0m
goto :eof

REM ============================================
REM Reset database
REM ============================================
:reset_database
echo.
echo [33m正在重置数据库...[0m

call :stop_services

if exist "%PROJECT_ROOT%\server\data\database.db" (
    del /f /q "%PROJECT_ROOT%\server\data\database.db" >nul 2>&1
    echo [32m✓ 已删除数据库文件[0m
)

echo [33m正在重新初始化数据库...[0m
cd /d "%PROJECT_ROOT%\server"
set "PORT=%BACKEND_PORT%"
node -e "const { initDatabase } = require('./db/database'); initDatabase(); console.log('✓ 数据库初始化完成');"

cd /d "%PROJECT_ROOT%"
echo [32m✓ 数据库重置完成[0m
echo [36m提示：默认超级管理员账号为 admin / admin123[0m
goto :eof

REM ============================================
REM Check port availability
REM ============================================
:check_ports
curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if not errorlevel 1 (
    echo [31m错误：前端端口 %FRONTEND_PORT% 已被占用[0m
    exit /b 1
)

curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if not errorlevel 1 (
    echo [31m错误：后端端口 %BACKEND_PORT% 已被占用[0m
    exit /b 1
)

echo [32m✓ 端口检查通过[0m
goto :eof

REM ============================================
REM Start services
REM ============================================
:start_services
echo.
echo ==========================================
echo   工具管理系统 - 启动服务
echo ==========================================
echo 配置：
echo   前端端口：%FRONTEND_PORT%
echo   后端端口：%BACKEND_PORT%
echo.

call :stop_services
call :check_ports

echo [33m正在启动后端服务...[0m
cd /d "%PROJECT_ROOT%\server"
set "PORT=%BACKEND_PORT%"
start /B cmd /c "node app.js > server.log 2>&1"

set /a waited=0
:wait_backend
if %waited% GEQ 30 goto :check_backend
timeout /t 1 >nul
curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if not errorlevel 1 goto :check_backend
set /a waited+=1
goto :wait_backend

:check_backend
curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if errorlevel 1 (
    echo [31m✗ 后端服务启动失败[0m
    type server.log
    exit /b 1
)
echo [32m✓ 后端服务已启动（端口 %BACKEND_PORT%）[0m

cd /d "%PROJECT_ROOT%"

echo [33m正在启动前端服务...[0m
cd /d "%PROJECT_ROOT%\frontend"
set "VITE_PORT=%FRONTEND_PORT%"
set "VITE_API_URL=http://localhost:%BACKEND_PORT%/api"
start /B cmd /c "npm run dev > frontend.log 2>&1"

set /a waited=0
:wait_frontend
if %waited% GEQ 60 goto :check_frontend
timeout /t 2 >nul
curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if not errorlevel 1 goto :check_frontend
set /a waited+=2
goto :wait_frontend

:check_frontend
curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if errorlevel 1 (
    echo [31m✗ 前端服务启动失败[0m
    type frontend.log
    exit /b 1
)
echo [32m✓ 前端服务已启动（端口 %FRONTEND_PORT%）[0m

cd /d "%PROJECT_ROOT%"

echo.
echo ==========================================
echo [32m  服务启动成功！[0m
echo ==========================================
echo.
echo   访问地址：
echo     前端：http://localhost:%FRONTEND_PORT%
echo     后端：http://localhost:%BACKEND_PORT%/api
echo.
echo   超级管理员账号：admin / admin123
echo.
echo   查看日志：
echo     后端：type server\server.log
echo     前端：type frontend\frontend.log
echo.
goto :eof

REM ============================================
REM Check status
REM ============================================
:status_services
echo.
echo ==========================================
echo   服务状态
echo ==========================================

curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if errorlevel 1 (
    echo [31m✗ 后端服务：未运行（端口 %BACKEND_PORT%）[0m
) else (
    echo [32m✓ 后端服务：运行中（端口 %BACKEND_PORT%）[0m
)

curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if errorlevel 1 (
    echo [31m✗ 前端服务：未运行（端口 %FRONTEND_PORT%）[0m
) else (
    echo [32m✓ 前端服务：运行中（端口 %FRONTEND_PORT%）[0m
)
echo.
goto :eof

REM ============================================
REM Main logic
REM ============================================
if "%1"=="start" goto :start_services
if "%1"=="restart" goto :start_services
if "%1"=="stop" goto :stop_services
if "%1"=="status" goto :status_services
if "%1"=="reset" (
    call :install_deps
    call :reset_database
    goto :eof
)

echo.
echo 工具管理系统 - 启动/停止脚本
echo.
echo 用法：
echo   %~nx0 start [前端端口] [后端端口]  启动服务（默认 3001 8080）
echo   %~nx0 stop                          停止服务
echo   %~nx0 restart [前端端口] [后端端口]  重启服务
echo   %~nx0 status                        查看服务状态
echo   %~nx0 reset                         重置数据库
echo.

endlocal
