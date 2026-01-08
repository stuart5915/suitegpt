@echo off
echo ============================================
echo   IDE Auto-Prompt Runner - Setup ^& Launch
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python first.
    pause
    exit /b 1
)

REM Install required packages
echo Installing required packages...
pip install pyautogui pygetwindow --quiet

echo.
echo Starting Auto-Prompt Runner...
echo.
echo SAFETY TIPS:
echo   - Move mouse to TOP-LEFT corner to ABORT immediately
echo   - Press Ctrl+C to stop gracefully
echo   - Keep Antigravity IDE window open
echo.
echo ============================================
echo.

REM Run the script
python "%~dp0auto-prompt-runner.py"

pause
