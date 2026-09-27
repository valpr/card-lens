#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Server Launcher & Auto-Updater

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${PORT:-5050}"
HOST="${HOST:-0.0.0.0}"
PID_FILE="$DIR/.cardlens.pid"

# ----------------------------------------------------
# 1. Detect Python & Uvicorn Binaries
# ----------------------------------------------------
if [ -f "$DIR/venv/bin/uvicorn" ]; then
  UVICORN_BIN="$DIR/venv/bin/uvicorn"
  PYTHON_BIN="$DIR/venv/bin/python"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN_BIN="uvicorn"
  PYTHON_BIN="$(command -v python3 || command -v python || true)"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
  UVICORN_BIN="python3 -m uvicorn"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
  UVICORN_BIN="python -m uvicorn"
else
  echo "Error: Python or uvicorn not found. Please run setup_termux.sh first."
  exit 1
fi

# ----------------------------------------------------
# 2. Check & Close Previous Instance Before Updating
# ----------------------------------------------------
echo "Checking for previous CardLens instance..."
previous_found=0

# A) Check PID file
if [ -f "$PID_FILE" ]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$old_pid" ] && [ "$old_pid" != "$$" ] && kill -0 "$old_pid" 2>/dev/null; then
    echo "Found previous CardLens instance (PID $old_pid). Stopping..."
    kill -TERM "$old_pid" 2>/dev/null || true
    previous_found=1
  fi
  rm -f "$PID_FILE"
fi

# B) Check running processes via pgrep (excluding self)
if command -v pgrep >/dev/null 2>&1; then
  matching_pids=$(pgrep -f "main:app" 2>/dev/null | grep -v "^$$\$" || true)
  if [ -n "$matching_pids" ]; then
    echo "Stopping existing CardLens process(es): $matching_pids..."
    for p in $matching_pids; do
      kill -TERM "$p" 2>/dev/null || true
    done
    previous_found=1
  fi
fi

# C) Use Python to ensure port is freed and catch any background processes
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" -c "
import os, signal, sys, time, socket

target_port = int('$PORT')
cur_pid = os.getpid()
parent_pid = os.getppid()

# Inspect /proc for any CardLens or uvicorn main:app processes
if os.path.exists('/proc'):
    for entry in os.listdir('/proc'):
        if entry.isdigit():
            p = int(entry)
            if p in (cur_pid, parent_pid, 1):
                continue
            try:
                with open(f'/proc/{p}/cmdline', 'rb') as f:
                    cmd = f.read().decode('utf-8', errors='ignore')
                if 'main:app' in cmd:
                    os.kill(p, signal.SIGTERM)
            except Exception:
                pass

# Poll until port is free (up to 2.5s)
port_freed = False
for _ in range(25):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('0.0.0.0', target_port))
        s.close()
        port_freed = True
        break
    except OSError:
        time.sleep(0.1)

# If still blocked, attempt SIGKILL on lingering processes
if not port_freed and os.path.exists('/proc'):
    for entry in os.listdir('/proc'):
        if entry.isdigit():
            p = int(entry)
            if p in (cur_pid, parent_pid, 1):
                continue
            try:
                with open(f'/proc/{p}/cmdline', 'rb') as f:
                    cmd = f.read().decode('utf-8', errors='ignore')
                if 'main:app' in cmd:
                    os.kill(p, signal.SIGKILL)
            except Exception:
                pass
" 2>/dev/null || true
fi

if [ "$previous_found" -eq 1 ]; then
  sleep 0.5
  echo "Previous instance closed."
fi

# ----------------------------------------------------
# 3. Pull Latest Updates from Repository
# ----------------------------------------------------
if [ -d ".git" ]; then
  echo "Checking for CardLens updates..."
  git -c http.connectTimeout=3 -c http.lowSpeedTime=3 pull --ff-only 2>/dev/null || true
fi

# ----------------------------------------------------
# 4. Save PID & Launch New Instance
# ----------------------------------------------------
echo "$$" > "$PID_FILE"

echo ""
echo "================================================"
echo "  CardLens Server is active!"
echo "  Open in browser: http://localhost:${PORT}"
echo "  Local address:   http://127.0.0.1:${PORT}"
echo "================================================"
echo ""

exec $UVICORN_BIN main:app --host "$HOST" --port "$PORT" "$@"
