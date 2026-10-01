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
echo "[1/6] Updating packages (full-upgrade to resolve library dependencies)..."
apt update && apt full-upgrade -y

# 2. Install system dependencies (build tools, libraries, and openssl CLI)
echo "[2/6] Installing system dependencies (python, git, build tools, openssl)..."
apt install -y python git build-essential libjpeg-turbo libpng openssl 2>/dev/null || apt install -y python git build-essential libjpeg-turbo libpng openssl-tool 2>/dev/null || true

# 3. Clone repo or update if needed
echo "[3/6] Setting up CardLens files..."
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

# 4. Set up Python virtual environment & install dependencies
# Note: In Termux, upgrading system pip is forbidden by design.
# Using a venv avoids PEP 668 conflicts and keeps dependencies isolated.
echo "[4/6] Setting up Python virtual environment & dependencies..."
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

# 5. Generate local SSL certificate for cross-device HTTPS (remote camera access)
echo "[5/6] Generating local SSL certificate for cross-device camera access..."
if [ ! -f "$INSTALL_DIR/cert.pem" ] || [ ! -f "$INSTALL_DIR/key.pem" ]; then
  if command -v openssl >/dev/null 2>&1; then
    openssl req -x509 -newkey rsa:2048 -keyout "$INSTALL_DIR/key.pem" -out "$INSTALL_DIR/cert.pem" -days 3650 -nodes -subj "/CN=cardlens" 2>/dev/null || true
    echo "✔ Generated cert.pem and key.pem in $INSTALL_DIR"
  else
    echo "Notice: openssl command not found. Skipping local certificate generation."
  fi
else
  echo "✔ Local SSL certificate already exists."
fi

# 6. Create CLI commands & Termux:Widget shortcuts
echo "[6/6] Setting up 'cardlens' commands and Termux:Widget shortcuts..."
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

  cat > "$PREFIX/bin/cardlens-ssl" << SCRIPT
#!$BASH_BIN
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true
exec "$BASH_BIN" "$INSTALL_DIR/run.sh" --ssl "\$@"
SCRIPT
  chmod +x "$PREFIX/bin/cardlens-ssl"
fi

mkdir -p ~/.shortcuts
cat > ~/.shortcuts/CardLens.sh << SCRIPT
#!$BASH_BIN
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true
exec "$BASH_BIN" "$INSTALL_DIR/run.sh"
SCRIPT
chmod +x ~/.shortcuts/CardLens.sh

cat > ~/.shortcuts/CardLens-SSL.sh << SCRIPT
#!$BASH_BIN
chmod +x "$INSTALL_DIR/run.sh" 2>/dev/null || true
exec "$BASH_BIN" "$INSTALL_DIR/run.sh" --ssl
SCRIPT
chmod +x ~/.shortcuts/CardLens-SSL.sh

# 7. Done
echo ""
echo "=== Setup complete! ==="
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Install Termux:Widget from F-Droid (optional, for home screen shortcuts)."
echo ""
echo "2. Add the widget to your home screen:"
echo "   Long-press home screen → Widgets → Termux:Widget → Termux shortcut (1x1)."
echo "   • Select 'CardLens.sh' for same-phone use (http://localhost:5050)."
echo "   • Select 'CardLens-SSL.sh' for remote camera phone access (https://<your-ip>:5050)."
echo ""
echo "3. Grant Termux permissions (Android 10+):"
echo "   Android Settings → Apps → Termux → Permissions:"
echo "   • 'Appear on top' / 'Display pop-up window' (to allow widget to launch)"
echo "   • Battery → 'Unrestricted' (prevents Android from killing the server)"
echo ""
echo "4. Starting the server:"
echo "   • Same phone: run 'cardlens' (opens http://localhost:5050 with 0 warnings)."
echo "   • From another phone: run 'cardlens-ssl' (opens https://<phone-ip>:5050)."
echo "     (When using HTTPS from another phone, accept the one-time browser risk warning)."
echo ""
echo "5. To stop the server:"
echo "   Open the Termux notification / window and press Ctrl+C."
echo ""
