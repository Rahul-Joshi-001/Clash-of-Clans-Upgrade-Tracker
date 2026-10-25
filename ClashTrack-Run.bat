
@echo off
setlocal EnableExtensions
title ClashTrack Launcher

cd /d "%~dp0"

echo.
echo ==========================================
echo          ClashTrack - Project Launcher
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo Install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found.
    pause
    exit /b 1
)

if not exist "Backend\package.json" (
    echo ERROR: Backend\package.json not found.
    echo Place this BAT file beside Backend and frontend.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo ERROR: frontend\package.json not found.
    pause
    exit /b 1
)

echo Checking backend dependencies...
if not exist "Backend\node_modules" (
    pushd "Backend"
    call npm install
    if errorlevel 1 (
        popd
        echo Backend installation failed.
        pause
        exit /b 1
    )
    popd
)

echo Checking frontend dependencies...
if not exist "frontend\node_modules" (
    pushd "frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo Frontend installation failed.
        pause
        exit /b 1
    )
    popd
)

echo.
echo Starting ClashTrack backend...
start "ClashTrack Backend" cmd /k "cd /d ""%~dp0Backend"" && node server.js"

timeout /t 3 /nobreak >nul

echo Starting ClashTrack frontend...
start "ClashTrack Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 127.0.0.1"

echo.
echo ==========================================
echo ClashTrack is starting!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo ==========================================
echo Keep both terminal windows open.
echo.
pause
endlocal
