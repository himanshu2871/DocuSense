@echo off
echo.
echo ================================================
echo   RAG App -- Backend Setup (Windows)
echo ================================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Python not found. Install from https://python.org
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo [OK] Python %PYVER% detected

:: Create venv
if not exist "venv" (
    echo [....] Creating virtual environment...
    python -m venv venv
    echo [OK] Virtual environment created
) else (
    echo [OK] Virtual environment already exists
)

:: Activate
call venv\Scripts\activate.bat
echo [OK] Virtual environment activated

:: Upgrade pip
python -m pip install --upgrade pip -q

:: Install dependencies
echo.
echo [....] Installing dependencies (may take 2-3 minutes)...
pip install -r requirements.txt -q
echo [OK] All dependencies installed

:: Copy .env
if not exist ".env" (
    copy .env.example .env >nul
    echo.
    echo [WARN] Created .env from .env.example
    echo        Open backend\.env and fill in MONGODB_URI and GROQ_API_KEY
    echo.
) else (
    echo [OK] .env file found
)

echo.
echo ================================================
echo   Setup complete!
echo   Next: fill in .env, then run:
echo   uvicorn main:app --reload --port 8000
echo ================================================
echo.
pause
