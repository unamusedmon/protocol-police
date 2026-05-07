#!/bin/bash

# Protocol Police - System Initialization Protocol
echo "🚨 PROTOCOL POLICE | Internal Affairs 🚨"
echo "Initializing System Initialization Protocol..."

# 1. Environment Configuration
if [ ! -f .env ]; then
  echo "[-] .env file missing. Cloning from .env.example..."
  cp .env.example .env
  echo "[!] IMPORTANT: Update your CHUB_API_KEY in .env before launching."
else
  echo "[+] .env file already exists. Skipping."
fi

# 2. Dependency Installation
echo "[*] Installing declassified dependencies..."
npm install

# 3. Database Initialization
echo "[*] Initializing The Evidence Locker (SQLite)..."
mkdir -p data
# Note: The DB is initialized on first run by src/lib/db.ts, 
# but we ensure the directory exists.

# 4. Success
echo ""
echo "✅ BOOT SEQUENCE COMPLETE."
echo "Launch the terminal with: npm run dev"
echo "Good luck, operator."
