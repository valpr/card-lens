#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Server Launcher & Auto-Updater

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Pull latest updates from repository if connected to internet (3s timeout)
if [ -d ".git" ]; then
  echo "Checking for CardLens updates..."
  git -c http.connectTimeout=3 -c http.lowSpeedTime=3 pull --ff-only 2>/dev/null || true
fi

# Detect uvicorn executable (venv vs system)
if [ -f "$DIR/venv/bin/uvicorn" ]; then
  UVICORN_BIN="$DIR/venv/bin/uvicorn"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN_BIN="uvicorn"
else
  echo "Error: uvicorn not found. Please run setup_termux.sh first."
  exit 1
fi

PORT="${PORT:-5050}"
HOST="${HOST:-0.0.0.0}"

echo ""
echo "================================================"
echo "  CardLens 🔍🎴 Server is active!"
echo "  Open in browser: http://localhost:${PORT}"
echo "  Local address:   http://127.0.0.1:${PORT}"
echo "================================================"
echo ""

exec "$UVICORN_BIN" main:app --host "$HOST" --port "$PORT" "$@"
