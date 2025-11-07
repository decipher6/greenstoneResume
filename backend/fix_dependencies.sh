#!/bin/bash
echo "🔧 Fixing backend dependencies..."

cd backend

# Upgrade pip
pip install --upgrade pip

# Uninstall problematic packages
pip uninstall -y sentence-transformers huggingface-hub transformers

# Reinstall with compatible versions
pip install sentence-transformers>=2.3.0
pip install huggingface-hub>=0.20.0

echo "✅ Dependencies fixed! Try running the server again."

