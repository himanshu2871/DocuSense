# RAG App — Windows Setup Script
# Run with: .\setup.ps1

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  RAG App — Backend Setup (Windows)" -ForegroundColor Cyan
Write-Host "================================================"
Write-Host ""

# Check Python version
try {
    $pyVersion = python --version 2>&1
    Write-Host "✅  $pyVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌  Python not found. Install from https://python.org" -ForegroundColor Red
    exit 1
}

# Check Python >= 3.11
$versionCheck = python -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌  Python 3.11+ required." -ForegroundColor Red
    exit 1
}

# Create virtual environment
if (-Not (Test-Path "venv")) {
    Write-Host "⏳  Creating virtual environment..."
    python -m venv venv
    Write-Host "✅  Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "✅  Virtual environment already exists" -ForegroundColor Green
}

# Activate
.\venv\Scripts\Activate.ps1
Write-Host "✅  Virtual environment activated" -ForegroundColor Green

# Upgrade pip
python -m pip install --upgrade pip -q

# Install dependencies
Write-Host ""
Write-Host "⏳  Installing dependencies (may take 2-3 minutes on first run)..."
pip install -r requirements.txt -q
Write-Host "✅  All dependencies installed" -ForegroundColor Green

# Copy .env.example if .env doesn't exist
if (-Not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "⚠️   Created .env from .env.example" -ForegroundColor Yellow
    Write-Host "     Open backend\.env and fill in:" -ForegroundColor Yellow
    Write-Host "       MONGODB_URI  — from MongoDB Atlas" -ForegroundColor Yellow
    Write-Host "       GROQ_API_KEY — from console.groq.com" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✅  .env file found" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup complete!"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Fill in backend\.env"
Write-Host "  2. Run:  .\venv\Scripts\Activate.ps1"
Write-Host "  3. Run:  uvicorn main:app --reload --port 8000"
Write-Host "  4. Open: http://localhost:8000/docs"
Write-Host "================================================"
Write-Host ""
