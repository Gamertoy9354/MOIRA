Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   MCP Gateway - Setup Utility" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Frontend
Write-Host "[1/3] Installing Frontend Dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

# 2. Backend
Write-Host "[2/3] Installing Backend Dependencies..." -ForegroundColor Yellow
pip install -r backend/requirements.txt

# 3. Environment Check
Write-Host "[3/3] Checking Infrastructure..." -ForegroundColor Yellow
$pgStatus = Get-Service postgresql* -ErrorAction SilentlyContinue
if ($pgStatus -and $pgStatus.Status -eq "Running") {
    Write-Host "  [OK] PostgreSQL service is running." -ForegroundColor Green
} else {
    Write-Host "  [WARN] PostgreSQL service might not be running! Port 5432 is required." -ForegroundColor Red
}

$redisStatus = Get-Process redis-server -ErrorAction SilentlyContinue
if ($redisStatus) {
    Write-Host "  [OK] Redis server is running." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Redis server process not found! Port 6379 is required." -ForegroundColor Red
}

Write-Host "`nSetup Complete! Now fill in your API keys in the .env file." -ForegroundColor DarkCyan
Write-Host "Then run 'run.bat' to start the application." -ForegroundColor Cyan
pause
