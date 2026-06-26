@echo off
echo ====================================================
echo  Starting The Last-Minute Life Saver Backend Server
echo ====================================================
echo.

:: Check if requirements are installed
echo Installing dependencies from requirements.txt...
python -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies. Please verify Python and Pip are on your path.
    pause
    exit /b %errorlevel%
)

echo.
echo Dependencies checked successfully.
echo Starting FastAPI server...
echo.
echo Application will be available at: http://127.0.0.1:8000
echo.

python main.py

pause
