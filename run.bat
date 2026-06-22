@echo off
echo ==========================================
echo   MCP Gateway - Unified Starter
echo ==========================================

:: Check for .env
if not exist .env (
    echo [ERROR] .env file not found!
    pause
    exit /b
)

:: Check Docker is running
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Docker is not running or not enabled. Bypassing Docker startup and using local services (like local Redis).
) else (
    rem Start Docker services (postgres + redis only)
    echo [1/3] Starting Docker services (PostgreSQL + Redis)...
    docker-compose up -d postgres redis

    echo [INFO] Waiting for services to be healthy...
    timeout /t 8 /nobreak >nul
)

:: Start Backend
echo [2/3] Starting Backend (FastAPI on port 8001)...
start "MCP Backend" cmd /k "cd backend && python main.py"

:: Give backend a moment to start
timeout /t 3 /nobreak >nul

:: Install frontend deps if needed, then start
echo [3/3] Starting Frontend (Vite on port 5173)...
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies first...
    start "MCP Frontend" cmd /k "cd frontend && npm install && npm run dev"
) else (
    start "MCP Frontend" cmd /k "cd frontend && npm run dev"
)

echo.
echo ==========================================
echo   All services are starting up!
echo   - Frontend:  http://localhost:5173
echo   - Backend:   http://localhost:8001
echo   - API Docs:  http://localhost:8001/docs
echo   - PostgreSQL: localhost:5432
echo   - Redis:      localhost:6379
echo ==========================================
echo.
echo To stop Docker services later, run: docker-compose down
pause
