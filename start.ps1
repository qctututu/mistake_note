# 错题本 - PowerShell 启动脚本
$ErrorActionPreference = "Stop"
$root = "D:\Study\mistake_note"
$backend = Join-Path $root "backend"

Write-Host "=== Mistake Note Starting ===" -ForegroundColor Cyan

Write-Host "[1/3] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location $backend
python -m pip install -r requirements.txt -q
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

Write-Host "[2/3] Starting backend server..." -ForegroundColor Yellow
$env:PYTHONIOENCODING = "utf-8"
$logFile = Join-Path $root "logs\backend.log"
Write-Host "     Log: $logFile" -ForegroundColor DarkGray
$job = Start-Job -ScriptBlock { param($d, $lf) Set-Location $d; python app.py *>> $lf } -ArgumentList $backend, $logFile
Write-Host "[OK] Backend Job ID: $($job.Id)" -ForegroundColor Green

Start-Sleep -Seconds 3

Write-Host "[3/3] Opening frontend..." -ForegroundColor Yellow
Start-Process (Join-Path $root "frontend\index.html")
Write-Host "[OK] Frontend opened in browser" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "       Mistake Note is running!" -ForegroundColor Cyan
Write-Host "     Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "     Frontend: opened in browser" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to stop backend..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -ErrorAction SilentlyContinue
