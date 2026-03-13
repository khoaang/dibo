#!/bin/bash

# Wait for network to be up
sleep 10

# Export display for X11
export DISPLAY=:0

# Navigate to project directory (where this script is located)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

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
    echo "Rebuilding app..."
    npm install
    npm run build
    echo "Update complete."
else
    echo "Already up to date."
fi

# Start the Node.js server
# Note: Ensure 'serve' is installed globally: npm install -g serve
npm start &

# Wait for server to start
sleep 5

# Disable screen blanking/saver
xset s noblank
xset s off
xset -dpms

# Hide mouse cursor if not moving
unclutter -idle 0.1 -root &

# Launch Chromium in Kiosk Mode
chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost:3000 --check-for-update-interval=31536000
