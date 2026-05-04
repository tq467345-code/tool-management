@echo off
rem Tool Management System Control Script

setlocal

set FRONTEND_PORT=%1
set BACKEND_PORT=%2

if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3001
if "%BACKEND_PORT%"=="" set BACKEND_PORT=8080

set SCRIPT_DIR=%~dp0
set FRONTEND_DIR=%SCRIPT_DIR%frontend
set BACKEND_DIR=%SCRIPT_DIR%server

if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="status" goto status

:usage
echo Usage: toolctl.bat {start^|stop^|restart^|status} [frontend_port] [backend_port]
exit /b 1

:start
echo Starting Tool Management System...
start cmd /k "cd /d %BACKEND_DIR% && node app.js"
timeout /t 2 /nobreak >nul
start cmd /k "cd /d %FRONTEND_DIR% && npm run dev -- --port %FRONTEND_PORT%"
echo Started
goto :eof

:stop
taskkill /f /im node.exe 2>nul
echo Stopped
goto :eof

:restart
call :stop
timeout /t 1 /nobreak >nul
call :start
goto :eof

:status
echo Tool Management System
if exist "%BACKEND_DIR%\node.exe" (
    echo Backend: Running
) else (
    echo Backend: Stopped
)
echo Check processes for frontend status
goto :eof