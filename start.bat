@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title MistakeNote

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_FILE=%ROOT%\frontend\index.html"
set "LOG_FILE=%ROOT%\logs\backend.log"
set "HEALTH_URL=http://127.0.0.1:5000/api/health"
set "MAX_RETRIES=12"
set "VENV_PY=%ROOT%\.venv\Scripts\python.exe"

if exist "%VENV_PY%" (
	set "PYTHON_EXE=%VENV_PY%"
) else (
	set "PYTHON_EXE=python"
)

echo Mistake Note - Starting...
echo.

cd /d "%ROOT%"

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"

echo [1/3] Installing backend dependencies...
cd /d "%BACKEND_DIR%"
"%PYTHON_EXE%" -m pip install -r requirements.txt -q
echo [OK] Dependencies installed
echo.

echo [2/3] Starting backend server...
echo Log: %LOG_FILE%
start "MistakeNote-Backend" cmd /c "cd /d \"%BACKEND_DIR%\" && \"%PYTHON_EXE%\" app.py"

echo [2.5/3] Waiting for backend health check...
set /a TRY=0

:HEALTH_CHECK
set /a TRY+=1
powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel%==0 goto HEALTH_OK
if %TRY% GEQ %MAX_RETRIES% goto HEALTH_FAIL
timeout /t 1 /nobreak >nul
goto HEALTH_CHECK

:HEALTH_OK
echo [OK] Backend health check passed

echo [3/3] Opening frontend...
start "" "%FRONTEND_FILE%"

echo.
echo =============================================
echo       Mistake Note is running!
echo     Backend:  http://localhost:5000
echo     Frontend: opened in browser
echo =============================================
echo.
pause
exit /b 0

:HEALTH_FAIL
echo.
echo [FAIL] Backend did not pass health check: %HEALTH_URL%
echo [HINT] If VS Code debug is already running, this may also be a port 5000 conflict.
echo [INFO] Printing latest 30 log lines from: %LOG_FILE%
echo -------------------------------------------------------------
powershell -NoProfile -Command "if (Test-Path '%LOG_FILE%') { Get-Content -Path '%LOG_FILE%' -Tail 30 } else { Write-Host 'Log file not found: %LOG_FILE%' }"
echo -------------------------------------------------------------
echo.
echo Startup aborted. Press any key to exit.
pause >nul
exit /b 1