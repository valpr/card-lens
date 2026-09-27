#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Termux Setup Script
# 
# Paste this into Termux to set up the environment:
#   pkg update -y && pkg install -y curl && curl -sL https://raw.githubusercontent.com/valpr/card-lens/main/setup_termux.sh | bash
# Or clone and run:
#   git clone https://github.com/valpr/card-lens.git cardlens && cd cardlens && bash setup_termux.sh

set -e

echo "=== CardLens: Termux Setup ==="
echo ""

# 1. Update package repos
echo "[1/6] Updating packages..."
pkg update -y && pkg upgrade -y

# 2. Install system dependencies
echo "[2/6] Installing system dependencies (python, git)..."
pkg install -y python git

# 3. Upgrade pip
echo "[3/6] Upgrading pip..."
pip install --upgrade pip

# 4. Clone repo if needed & install dependencies
echo "[4/6] Setting up CardLens files & Python dependencies..."
if [ ! -f "main.py" ]; then
  if [ ! -d "$HOME/cardlens" ]; then
    echo "Cloning CardLens repository into $HOME/cardlens..."
    git clone https://github.com/valpr/card-lens.git "$HOME/cardlens"
  fi
  cd "$HOME/cardlens"
fi

INSTALL_DIR="$(pwd)"

if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
else
  pip install fastapi uvicorn chrome-lens-py pillow python-multipart
fi

# 5. Create CLI command & Termux:Widget shortcut
echo "[5/6] Setting up 'cardlens' command and Termux:Widget shortcut..."
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
if [ -d "$PREFIX/bin" ]; then
  cat > "$PREFIX/bin/cardlens" << SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
cd "$INSTALL_DIR"
exec uvicorn main:app --host 0.0.0.0 --port 5050 "\$@"
SCRIPT
  chmod +x "$PREFIX/bin/cardlens"
fi

mkdir -p ~/.shortcuts
cat > ~/.shortcuts/CardLens.sh << SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
cd "$INSTALL_DIR"
uvicorn main:app --host 0.0.0.0 --port 5050
SCRIPT
chmod +x ~/.shortcuts/CardLens.sh

# 6. Done
echo "[6/6] Setup complete!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Install Termux:Widget from F-Droid (must match Termux's install source)."
echo ""
echo "2. Add the widget to your home screen:"
echo "   Long-press home screen → Widgets → Termux:Widget → place it."
echo "   Select 'CardLens.sh' (or add the 1x1 shortcut icon)."
echo ""
echo "3. Grant Termux permissions (Android 10+):"
echo "   Android Settings → Apps → Termux → Permissions:"
echo "   • 'Appear on top' / 'Display pop-up window' (to allow widget to launch)"
echo "   • Battery → 'Unrestricted' (prevents Android from killing the server)"
echo ""
echo "4. Tap 'CardLens' on your home screen (or run 'cardlens' in Termux) to start,"
echo "   then open http://localhost:5050 in Firefox Android."
echo ""
echo "5. To stop the server:"
echo "   Open the Termux notification / window and press Ctrl+C."
echo ""
