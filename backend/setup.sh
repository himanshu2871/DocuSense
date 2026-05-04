#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  RAG App — Backend Setup"
echo "================================================"
echo ""

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
REQUIRED="3.11"
if python3 -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)"; then
  echo "✅ Python $PYTHON_VERSION detected"
else
  echo "❌ Python 3.11+ required. You have $PYTHON_VERSION"
  exit 1
fi

# Create virtual environment
if [ ! -d "venv" ]; then
  echo "⏳ Creating virtual environment..."
  python3 -m venv venv
  echo "✅ Virtual environment created"
else
  echo "✅ Virtual environment already exists"
fi

# Activate
source venv/bin/activate
echo "✅ Virtual environment activated"

# Upgrade pip silently
pip install --upgrade pip -q

# Install dependencies
echo ""
echo "⏳ Installing dependencies (this may take 2-3 minutes on first run)..."
pip install -r requirements.txt -q
echo "✅ All dependencies installed"

# Check .env exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Created .env from .env.example"
  echo "    → Open backend/.env and fill in:"
  echo "       MONGODB_URI  — from MongoDB Atlas"
  echo "       GROQ_API_KEY — from console.groq.com"
  echo ""
else
  echo "✅ .env file found"
fi

echo ""
echo "================================================"
echo "  Setup complete!"
echo ""
echo "  Next:"
echo "  1. Fill in backend/.env if you haven't yet"
echo "  2. Run:  source venv/bin/activate"
echo "  3. Run:  uvicorn main:app --reload --port 8000"
echo "  4. Open: http://localhost:8000/docs"
echo "================================================"
echo ""
