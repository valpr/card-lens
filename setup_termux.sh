#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Termux Setup Script
# 
# Paste this into Termux to set up the environment:
#   apt update && apt full-upgrade -y && apt install -y curl && curl -sL https://raw.githubusercontent.com/valpr/card-lens/main/setup_termux.sh | bash
# Or clone and run:
#   git clone https://github.com/valpr/card-lens.git cardlens && cd cardlens && bash setup_termux.sh

set -e

# Prevent executing on Android shared storage (/sdcard) where execution is blocked
case "$(pwd)" in
  /sdcard*|/storage*|/mnt/sdcard*|/mnt/runtime*)
    echo "=========================================================="
    echo "ERROR: CardLens cannot run from shared storage ($(pwd))!"
    echo "Android prevents executing scripts & binaries in /sdcard."
    echo ""
    echo "Please clone and run CardLens from your Termux home directory:"
    echo "  cd ~"
    echo "  git clone https://github.com/valpr/card-lens.git cardlens"
    echo "  cd cardlens && bash setup_termux.sh"
    echo "=========================================================="
    exit 1
    ;;
esac

echo "=== CardLens: Termux Setup ==="
echo ""

# 1. Update package repos
echo "[1/5] Updating packages (full-upgrade to resolve library dependencies)..."
apt update && apt full-upgrade -y

# 2. Install system dependencies (build tools, libraries)
echo "[2/5] Installing system dependencies (python, git, build tools)..."
apt install -y python git build-essential libjpeg-turbo libpng 2>/dev/null || true

# 3. Clone repo or update if needed
echo "[3/5] Setting up CardLens files..."
if [ ! -f "main.py" ]; then
  if [ ! -d "$HOME/cardlens" ]; then
    echo "Cloning CardLens repository into $HOME/cardlens..."
    git clone --depth 1 https://github.com/valpr/card-lens.git "$HOME/cardlens"
  fi
  cd "$HOME/cardlens"
fi

INSTALL_DIR="$(pwd)"

if [ -d ".git" ]; then
  # Only fast-forward if working tree has no uncommitted changes
  if git diff-index --quiet HEAD -- 2>/dev/null; then
    git pull --ff-only origin main 2>/dev/null || true
  fi
  chmod +x "$INSTALL_DIR/run.sh" "$INSTALL_DIR/setup_termux.sh" 2>/dev/null || true
fi

# Clean up any legacy SSL certificates
rm -f "$INSTALL_DIR/cert.pem" "$INSTALL_DIR/key.pem" 2>/dev/null || true

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
chmod +x "$INSTALL_DIR/run.sh" "$INSTALL_DIR/setup_termux.sh" 2>/dev/null || true

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
BASH_BIN="$PREFIX/bin/bash"
if [ ! -x "$BASH_BIN" ]; then
  BASH_BIN="$(command -v bash || echo "/data/data/com.termux/files/usr/bin/bash")"
fi

if [ -d "$PREFIX/bin" ]; then
  cat > "$PREFIX/bin/cardlens" << SCRIPT
#!$BASH_BIN
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true
exec "$BASH_BIN" "$INSTALL_DIR/run.sh" "\$@"
SCRIPT
  chmod +x "$PREFIX/bin/cardlens"
  rm -f "$PREFIX/bin/cardlens-ssl" 2>/dev/null || true
fi

mkdir -p ~/.shortcuts
cat > ~/.shortcuts/CardLens.sh << SCRIPT
#!$BASH_BIN
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true
exec "$BASH_BIN" "$INSTALL_DIR/run.sh"
SCRIPT
chmod +x ~/.shortcuts/CardLens.sh
rm -f ~/.shortcuts/CardLens-SSL.sh 2>/dev/null || true

# Done
echo ""
echo "=== Setup complete! ==="
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Install Termux:Widget from F-Droid (optional, for home screen shortcuts)."
echo ""
echo "2. Add the widget to your home screen:"
echo "   Long-press home screen → Widgets → Termux:Widget → Termux shortcut (1x1)."
echo "   • Select 'CardLens.sh' (opens http://localhost:5050)."
echo ""
echo "3. Grant Termux permissions (Android 10+):"
echo "   Android Settings → Apps → Termux → Permissions:"
echo "   • 'Appear on top' / 'Display pop-up window' (to allow widget to launch)"
echo "   • Battery → 'Unrestricted' (prevents Android from killing the server)"
echo ""
echo "4. Accessing CardLens:"
echo "   • Start: Run 'cardlens' in Termux or tap the CardLens.sh widget."
echo "   • Same phone: Open http://localhost:5050 in Firefox (in-app viewfinder enabled)."
echo "   • Other device on Wi-Fi: Open http://<network-ip>:5050 (native camera fallback)."
echo ""
echo "5. To stop the server:"
echo "   Open the Termux notification / window and press Ctrl+C."
echo ""
