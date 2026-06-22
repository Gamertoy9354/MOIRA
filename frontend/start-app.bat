@echo off
echo =======================================================
echo     MCP Orchestration Gateway - Next-Gen Setup 🚀
echo =======================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! 
    echo Please download and install Node.js from https://nodejs.org/ first.
    echo.
    pause
    exit /b
)

echo [✓] Node.js is installed.

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing required dependencies...
    echo        (This reads the package.json, which is the exact equivalent of requirements.txt)
    call npm install
    
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies! Please check your internet connection.
        pause
        exit /b
    )
    echo [✓] All dependencies installed successfully!
) else (
    echo [✓] Dependencies are already installed. (node_modules folder found)
)

echo.
echo =======================================================
echo     Starting Local Development Server...
echo =======================================================
echo.
echo The app will open in your browser automatically.
echo (Press CTRL+C anytime in this window to stop the server)
echo.

:: Start the server
call npm run dev
