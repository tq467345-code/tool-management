@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================
REM Tool Management System - Start/Stop Script (Windows)
REM Usage:
REM   toolctl.bat start [frontend_port] [backend_port]  - Start services
REM   toolctl.bat stop                          - Stop services
REM   toolctl.bat restart [frontend_port] [backend_port] - Restart services
REM   toolctl.bat status                        - Check service status
REM ============================================

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

REM Default ports
set "FRONTEND_PORT=%1"
set "BACKEND_PORT=%2"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3001"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8080"

REM ============================================
REM Check Node.js environment
REM ============================================
where node >nul 2>&1
if errorlevel 1 (
    echo [31mError: Node.js is not installed[0m
    echo Please visit https://nodejs.org to install Node.js 18+
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VERSION_FULL=%%i"
for /f "tokens=2 delims=v" %%i in ('echo %NODE_VERSION_FULL%') do set "NODE_VERSION=%%i"
for /f "tokens=1 delims=." %%i in ('echo %NODE_VERSION%') do set "NODE_VERSION_MAJOR=%%i"

if %NODE_VERSION_MAJOR% LSS 18 (
    echo [31mError: Node.js version must be ^>= 18.0.0[0m
    echo Current version: %NODE_VERSION_FULL%
    exit /b 1
)
echo [32m✓ Node.js version: %NODE_VERSION_FULL%[0m

REM ============================================
REM Install dependencies
REM ============================================
echo.
echo [33mChecking and installing dependencies...[0m

REM Create data directory
if not exist "%PROJECT_ROOT%\server\data" (
    mkdir "%PROJECT_ROOT%\server\data" >nul 2>&1
)

REM Backend dependencies
if exist "%PROJECT_ROOT%\server\package.json" (
    if not exist "%PROJECT_ROOT%\server\node_modules" (
        echo   Installing backend dependencies...
        cd /d "%PROJECT_ROOT%\server"
        call npm install --silent >nul 2>&1
    )
)

REM Frontend dependencies
if exist "%PROJECT_ROOT%\frontend\package.json" (
    if not exist "%PROJECT_ROOT%\frontend\node_modules" (
        echo   Installing frontend dependencies...
        cd /d "%PROJECT_ROOT%\frontend"
        call npm install --silent >nul 2>&1
    )
)

REM Performance test dependencies (optional)
if exist "%PROJECT_ROOT%\perf-test\package.json" (
    if not exist "%PROJECT_ROOT%\perf-test\node_modules" (
        echo   Installing performance test dependencies...
        cd /d "%PROJECT_ROOT%\perf-test"
        call npm install --silent >nul 2>&1
    )
)

echo [32m✓ Dependency check complete[0m

REM ============================================
REM Stop services
REM ============================================
:stop_services
echo.
echo [33mStopping services...[0m

REM Stop backend
if exist "%PROJECT_ROOT%\server\.backend.pid" (
    for /f "delims=" %%a in ('type "%PROJECT_ROOT%\server\.backend.pid"') do set "BACKEND_PID=%%a"
    if not "!BACKEND_PID!"=="" (
        taskkill /F /PID !BACKEND_PID! >nul 2>&1
    )
    del "%PROJECT_ROOT%\server\.backend.pid" >nul 2>&1
)

REM Force stop processes using backend port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Stop frontend
if exist "%PROJECT_ROOT%\frontend\.frontend.pid" (
    for /f "delims=" %%a in ('type "%PROJECT_ROOT%\frontend\.frontend.pid"') do set "FRONTEND_PID=%%a"
    if not "!FRONTEND_PID!"=="" (
        taskkill /F /PID !FRONTEND_PID! >nul 2>&1
    )
    del "%PROJECT_ROOT%\frontend\.frontend.pid" >nul 2>&1
)

REM Force stop processes using frontend port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 >nul
echo [32m✓ Services stopped[0m
goto :end_stop

:end_stop

REM ============================================
REM Start services
REM ============================================
:start_services
echo.
echo ==========================================
echo   Tool Management System - Start Services
echo ==========================================
echo Configuration:
echo   Frontend port: %FRONTEND_PORT%
echo   Backend port: %BACKEND_PORT%
echo.

call :stop_services

REM Start backend
echo [33mStarting backend service...[0m
cd /d "%PROJECT_ROOT%\server"
set "PORT=%BACKEND_PORT%"
start /B cmd /c "node app.js > server.log 2>&1"

REM Wait for backend to start
timeout /t 3 >nul

REM Check backend
curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if errorlevel 1 (
    echo [31m✗ Backend service failed to start[0m
    type server.log
    exit /b 1
)
echo [32m✓ Backend service started (port %BACKEND_PORT%)[0m]

cd /d "%PROJECT_ROOT%"


REM Start frontend
echo [33mStarting frontend service...[0m
cd /d "%PROJECT_ROOT%\frontend"
set "VITE_PORT=%FRONTEND_PORT%"
set "VITE_API_URL=http://localhost:%BACKEND_PORT%/api"
start /B cmd /c "npm run dev > frontend.log 2>&1"

REM Wait for frontend to start
timeout /t 5 >nul

REM Check frontend
curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if errorlevel 1 (
    echo [31m✗ Frontend service failed to start[0m
    type frontend.log
    exit /b 1
)
echo [32m✓ Frontend service started (port %FRONTEND_PORT%)[0m]

cd /d "%PROJECT_ROOT%"

echo.
echo ==========================================
echo [32m  Services started successfully![0m
echo ==========================================
echo.
echo   Access URLs:
echo     Frontend: http://localhost:%FRONTEND_PORT%
echo     Backend: http://localhost:%BACKEND_PORT%/api
echo.
echo   Super admin: admin / admin123
echo.
echo   View logs:
echo     Backend: type server\server.log
echo     Frontend: type frontend\frontend.log
echo.
goto :end_start

:end_start

REM ============================================
REM Check status
REM ============================================
:status_services
echo.
echo ==========================================
echo   Service Status
echo ==========================================

curl -s http://localhost:%BACKEND_PORT%/api/auth/login >nul 2>&1
if errorlevel 1 (
    echo [31m✗ Backend service: Not running (port %BACKEND_PORT%)[0m
) else (
    echo [32m✓ Backend service: Running (port %BACKEND_PORT%)[0m
)

curl -s http://localhost:%FRONTEND_PORT% >nul 2>&1
if errorlevel 1 (
    echo [31m✗ Frontend service: Not running (port %FRONTEND_PORT%)[0m
) else (
    echo [32m✓ Frontend service: Running (port %FRONTEND_PORT%)[0m
)
echo.
goto :end_status

:end_status

REM ============================================
REM Main logic
REM ============================================
if "%1"=="start" goto :start_services
if "%1"=="restart" goto :start_services
if "%1"=="stop" goto :stop_services
if "%1"=="status" goto :status_services

echo.
echo Tool Management System - Start/Stop Script
echo.
echo Usage:
echo   %~nx0 start [frontend_port] [backend_port]  Start services (default 3001 8080)
echo   %~nx0 stop                         Stop services
echo   %~nx0 restart [frontend_port] [backend_port]  Restart services
echo   %~nx0 status                       Check service status
echo.

endlocal