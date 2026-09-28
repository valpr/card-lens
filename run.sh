#!/data/data/com.termux/files/usr/bin/bash
# CardLens — Server Launcher & Auto-Updater

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Prevent executing on Android shared storage (/sdcard) where execution is blocked
case "$DIR" in
  /sdcard*|/storage*|/mnt/sdcard*|/mnt/runtime*)
    echo "=========================================================="
    echo "ERROR: CardLens cannot run from shared storage ($DIR)!"
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

# Ensure this script and setup script remain executable
chmod +x "$0" "$DIR/run.sh" "$DIR/setup_termux.sh" 2>/dev/null || true

PORT="${PORT:-5050}"
HOST="${HOST:-0.0.0.0}"
PID_FILE="$DIR/.cardlens.pid"

# ----------------------------------------------------
# Handle 'update' subcommand
# ----------------------------------------------------
if [ "$1" = "update" ]; then
  echo "=== CardLens: Updating to latest version ==="
  if [ -d "$DIR/.git" ]; then
    if git -c http.connectTimeout=10 fetch origin main; then
      git reset --hard origin/main
      chmod +x "$DIR/run.sh" "$DIR/setup_termux.sh" 2>/dev/null || true
      if [ -f "$DIR/venv/bin/pip" ]; then
        "$DIR/venv/bin/pip" install --extra-index-url https://termux-user-repository.github.io/pypi/ -r "$DIR/requirements.txt"
      fi
      echo "CardLens updated successfully to $(git rev-parse --short HEAD)!"
    else
      echo "Error: Could not connect to GitHub to update."
      exit 1
    fi
  else
    echo "Notice: Not a git repository. Re-run setup_termux.sh to update."
  fi
  exit 0
fi

# ----------------------------------------------------
# 1. Detect Python & Ensure Binaries Are Executable
# ----------------------------------------------------
if [ -d "$DIR/venv/bin" ]; then
  chmod -R +x "$DIR/venv/bin" 2>/dev/null || true
fi

if [ -f "$DIR/venv/bin/python" ]; then
  PYTHON_BIN="$DIR/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
elif command -v uvicorn >/dev/null 2>&1; then
  PYTHON_BIN=""
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
    kill -9 "$old_pid" 2>/dev/null || true
    previous_found=1
  fi
  rm -f "$PID_FILE"
fi

# B) Force kill any lingering processes on port or uvicorn
fuser -k -9 "${PORT}/tcp" 2>/dev/null || true
if command -v pkill >/dev/null 2>&1; then
  pkill -9 -f "main:app" 2>/dev/null || true
  pkill -9 -f "uvicorn" 2>/dev/null || true
fi

# C) Use Python to ensure port is freed and catch any background processes via /proc/net/tcp
if [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" -c "
import os, signal, sys, time, socket

target_port = int('$PORT')
cur_pid = os.getpid()
parent_pid = os.getppid()

def find_pids_on_port(port):
    port_hex = f'{port:04X}'
    inodes = set()
    for net_file in ('/proc/net/tcp', '/proc/net/tcp6'):
        if os.path.exists(net_file):
            try:
                with open(net_file, 'r') as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) >= 10 and ':' in parts[1]:
                            local_port = parts[1].split(':')[1]
                            if local_port.upper() == port_hex:
                                inodes.add(parts[9])
            except Exception:
                pass
    pids = set()
    if os.path.exists('/proc'):
        for entry in os.listdir('/proc'):
            if entry.isdigit():
                p = int(entry)
                if p in (cur_pid, parent_pid, 1):
                    continue
                fd_dir = f'/proc/{p}/fd'
                if os.path.exists(fd_dir):
                    try:
                        for fd in os.listdir(fd_dir):
                            target = os.readlink(f'{fd_dir}/{fd}')
                            for inode in inodes:
                                if f'[{inode}]' in target:
                                    pids.add(p)
                    except Exception:
                        pass
    return pids

# Kill any process holding the port directly
for p in find_pids_on_port(target_port):
    try:
        os.kill(p, signal.SIGKILL)
    except Exception:
        pass

# Also kill any remaining main:app processes
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
                    os.kill(p, signal.SIGKILL)
            except Exception:
                pass

# Poll until port is free (up to 2.5s)
for _ in range(25):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('0.0.0.0', target_port))
        s.close()
        break
    except OSError:
        time.sleep(0.1)
" 2>/dev/null || true
fi

# ----------------------------------------------------
# 3. Check for Updates (Non-blocking & Non-destructive)
# ----------------------------------------------------
if [ -d ".git" ] && [ "${CARDLENS_AUTO_UPDATE:-0}" = "1" ]; then
  if git -c http.connectTimeout=3 -c http.lowSpeedTime=3 fetch origin main 2>/dev/null; then
    LOCAL_REV=$(git rev-parse HEAD 2>/dev/null || true)
    REMOTE_REV=$(git rev-parse origin/main 2>/dev/null || true)
    if [ -n "$LOCAL_REV" ] && [ -n "$REMOTE_REV" ] && [ "$LOCAL_REV" != "$REMOTE_REV" ]; then
      echo "Notice: A newer version of CardLens is available! Run 'cardlens update' to install."
    fi
  fi
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

if [ -n "$PYTHON_BIN" ]; then
  exec "$PYTHON_BIN" -m uvicorn main:app --host "$HOST" --port "$PORT" "$@"
else
  exec uvicorn main:app --host "$HOST" --port "$PORT" "$@"
fi
