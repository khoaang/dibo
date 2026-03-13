#!/bin/bash

# Wait for network to be up
sleep 10

# Export display for X11
export DISPLAY=:0

# Navigate to repo and app directories
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_DIR/dibo-tracker"
cd "$REPO_DIR"

# Ensure we are on the main branch
git checkout main

# Check for updates
echo "Checking for updates..."
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
    echo "Update found! Pulling changes..."
    git pull origin main
    
    cd "$APP_DIR"
    
    echo "Rebuilding app..."
    npm install
    npm run build
    
    # Go back to repo root
    cd "$REPO_DIR"
    
    echo "Update complete."
else
    echo "Already up to date."
fi

# Enter app directory to start
cd "$APP_DIR"

# Start the Node.js server
# Note: Ensure 'serve' is installed globally: npm install -g serve
npm start &

# Wait for server to start
sleep 5

# Disable screen blanking/saver
xset s noblank || true
xset s off || true
xset -dpms || true

# Hide mouse cursor if not moving
pkill unclutter >/dev/null 2>&1 || true
unclutter -idle 0.1 -root &

# Launch Chromium in Kiosk Mode
chromium-browser --noerrdialogs --disable-infobars --kiosk --force-device-scale-factor=1.6 http://localhost:3000 --check-for-update-interval=31536000
