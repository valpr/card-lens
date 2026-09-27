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
echo "[1/5] Updating packages..."
pkg update -y && pkg upgrade -y

# 2. Install system dependencies (build tools & libraries needed for Pillow)
echo "[2/5] Installing system dependencies (python, git, build tools)..."
pkg install -y python git build-essential libjpeg-turbo libpng

# 3. Clone repo or update if needed
echo "[3/5] Setting up CardLens files..."
if [ ! -f "main.py" ]; then
  if [ ! -d "$HOME/cardlens" ]; then
    echo "Cloning CardLens repository into $HOME/cardlens..."
    git clone https://github.com/valpr/card-lens.git "$HOME/cardlens"
  fi
  cd "$HOME/cardlens"
fi

INSTALL_DIR="$(pwd)"

if [ -d ".git" ]; then
  git fetch origin main 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || git pull --ff-only 2>/dev/null || true
fi

# 4. Set up Python virtual environment & install dependencies
# Note: In Termux, upgrading system pip is forbidden by design.
# Using a venv avoids PEP 668 conflicts and keeps dependencies isolated.
echo "[4/5] Setting up Python virtual environment & dependencies..."
VENV_DIR="$INSTALL_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
  python -m venv "$VENV_DIR"
fi

if [ -f "$VENV_DIR/bin/pip" ]; then
  RUN_UVICORN="$VENV_DIR/bin/uvicorn"
  "$VENV_DIR/bin/pip" install --extra-index-url https://termux-user-repository.github.io/pypi/ -r requirements.txt
else
  RUN_UVICORN="uvicorn"
  pip install --break-system-packages --extra-index-url https://termux-user-repository.github.io/pypi/ -r requirements.txt
fi

# 5. Create CLI command & Termux:Widget shortcut
echo "[5/5] Setting up 'cardlens' command and Termux:Widget shortcut..."
chmod +x "$INSTALL_DIR/run.sh"

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
if [ -d "$PREFIX/bin" ]; then
  cat > "$PREFIX/bin/cardlens" << SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
exec "$INSTALL_DIR/run.sh" "\$@"
SCRIPT
  chmod +x "$PREFIX/bin/cardlens"
fi

mkdir -p ~/.shortcuts
cat > ~/.shortcuts/CardLens.sh << SCRIPT
#!/data/data/com.termux/files/usr/bin/bash
exec "$INSTALL_DIR/run.sh"
SCRIPT
chmod +x ~/.shortcuts/CardLens.sh

# 6. Done
echo ""
echo "=== Setup complete! ==="
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Install Termux:Widget from F-Droid (optional, for home screen shortcut)."
echo ""
echo "2. Add the widget to your home screen:"
echo "   Long-press home screen → Widgets → Termux:Widget → Termux shortcut (1x1)."
echo "   Select 'CardLens.sh'."
echo ""
echo "3. Grant Termux permissions (Android 10+):"
echo "   Android Settings → Apps → Termux → Permissions:"
echo "   • 'Appear on top' / 'Display pop-up window' (to allow widget to launch)"
echo "   • Battery → 'Unrestricted' (prevents Android from killing the server)"
echo ""
echo "4. Tap 'CardLens' on your home screen (or type 'cardlens' in Termux) to start,"
echo "   then open http://localhost:5050 in Firefox Android."
echo ""
echo "5. To stop the server:"
echo "   Open the Termux notification / window and press Ctrl+C."
echo ""
