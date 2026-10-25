#!/bin/bash

set -u

# Boot-time output is otherwise invisible, so keep a log around.
exec >> /tmp/dibo-kiosk.log 2>&1
echo "=== $(date) Dibo kiosk starting ==="

# Prevent duplicate kiosk sessions if autostart triggers twice.
LOCK_FILE="/tmp/dibo-kiosk.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another kiosk instance running, exiting."
    exit 0
fi

# Autostart can fire before the desktop is up.
export DISPLAY=:0
i=0
while [ "$i" -lt 30 ]; do
    if xset q &>/dev/null; then
        echo "X display ready after ${i}s"
        break
    fi
    i=$((i + 1))
    sleep 1
done
if [ "$i" -eq 30 ]; then
    echo "ERROR: X display not ready after 30s, exiting."
    exit 1
fi

# The Pi has no hardware clock, so it boots with a stale time until NTP catches up.
# Wait for that (up to a minute) so the dashboard doesn't show the wrong day or
# reject walks as being "in the future".
for _ in $(seq 1 60); do
    if [ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = "yes" ]; then
        echo "Clock synced: $(date)"
        break
    fi
    sleep 1
done

# Navigate to repo and app directories
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_DIR/dibo-tracker"
cd "$REPO_DIR"

ensure_latest_build() {
    # Skip update logic if local changes exist to avoid checkout/pull failures.
    if ! git diff-index --quiet HEAD --; then
        echo "Local changes detected, skipping auto-update."
        return
    fi

    git checkout main >/dev/null 2>&1 || true
    echo "Checking for updates..."
    git fetch origin main
    LOCAL="$(git rev-parse HEAD)"
    REMOTE="$(git rev-parse origin/main)"

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "Update found! Pulling changes..."
        git pull origin main
        cd "$APP_DIR"
        echo "Rebuilding app..."
        npm install
        npm run build
        cd "$REPO_DIR"
        echo "Update complete."
    else
        echo "Already up to date."
    fi
}

start_server() {
    cd "$APP_DIR"
    # Clean up old server process from a prior run.
    pkill -f "serve -s dist -l 3000" >/dev/null 2>&1 || true
    npm start >/tmp/dibo-server.log 2>&1 &
    SERVER_PID=$!
    sleep 3
}

ensure_latest_build
start_server

# Hide mouse cursor if not moving
pkill unclutter >/dev/null 2>&1 || true
unclutter -idle 0.1 -root &

while true; do
    # Disable screen blanking/saver repeatedly in case desktop resets it.
    xset s noblank || true
    xset s off || true
    xset -dpms || true

    # Recover web server if it crashes.
    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        echo "Web server stopped, restarting..."
        start_server
    fi

    # Launch Chromium in kiosk mode; if it exits, loop relaunches it.
    chromium-browser --noerrdialogs --disable-infobars --kiosk --force-device-scale-factor=1.6 http://localhost:3000 --check-for-update-interval=31536000
    echo "Chromium exited, relaunching in 2 seconds..."
    sleep 2
done
