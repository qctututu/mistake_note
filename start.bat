@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title MistakeNote

echo Mistake Note - Starting...
echo.

cd /d "E:\myPython\mistake_note"

echo [1/3] Installing backend dependencies...
cd backend
python -m pip install -r requirements.txt -q
echo [OK] Dependencies installed
echo.

echo [2/3] Starting backend server...
echo Log: ..\logs\backend.log
start "MistakeNote-Backend" cmd /c "python app.py >> "..\logs\backend.log" 2>&1"

timeout /t 3 /nobreak >nul

echo [3/3] Opening frontend...
start "" "E:\myPython\mistake_note\frontend\index.html"

echo.
echo =============================================
echo       Mistake Note is running!
echo     Backend:  http://localhost:5000
echo     Frontend: opened in browser
echo =============================================
echo.
pause