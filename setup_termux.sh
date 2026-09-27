#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Termux Setup Script
# 
# Paste this into Termux to set up the environment:
#   curl -sL <your-raw-url> | bash
# Or copy the file and run:
#   bash setup_termux.sh

set -e

echo "=== CardLens: Termux Setup ==="
echo ""

# 1. Update package repos
echo "[1/6] Updating packages..."
pkg update -y && pkg upgrade -y

# 2. Install system dependencies
echo "[2/6] Installing system dependencies..."
pkg install -y python

# 3. Upgrade pip
echo "[3/6] Upgrading pip..."
pip install --upgrade pip

# 4. Install Python dependencies
echo "[4/6] Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
else
  pip install fastapi uvicorn chrome-lens-py pillow python-multipart
fi

# 5. Create Termux:Widget shortcut
echo "[5/6] Setting up Termux:Widget shortcut..."
mkdir -p ~/.shortcuts
cat > ~/.shortcuts/CardLens.sh << 'SCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
if [ -d "$HOME/cardlens" ]; then
  cd "$HOME/cardlens"
elif [ -d "$HOME/snap2anki" ]; then
  cd "$HOME/snap2anki"
else
  cd "$HOME/console-capture"
fi
uvicorn main:app --host 0.0.0.0 --port 5050
SCRIPT
chmod +x ~/.shortcuts/CardLens.sh

# 6. Done
echo "[6/6] Setup complete!"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Install Termux:Widget from F-Droid (if not already installed)."
echo ""
echo "2. Add the widget to your home screen:"
echo "   Long-press home screen → Widgets → Termux:Widget → place it."
echo "   Tap 'CardLens' to start the server."
echo ""
echo "3. Disable battery optimization for Termux:"
echo "   Android Settings → Apps → Termux → Battery → Unrestricted"
echo ""
echo "4. When the server is running, open Firefox Android:"
echo "   http://localhost:5050"
echo ""
echo "5. To stop the server:"
echo "   Swipe away the Termux notification, or open Termux and press Ctrl+C."
echo ""
