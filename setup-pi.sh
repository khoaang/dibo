#!/bin/bash

# Dibo Tracker - Raspberry Pi Setup Script
# Run this script on the Raspberry Pi to set up the environment.

set -e # Exit on error

echo "🐶 Starting Dibo Tracker Setup..."

# Get the absolute path of the repo root and app directory
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_DIR/dibo-tracker"
CURRENT_USER="$(whoami)"

echo "📂 Repo Directory: $REPO_DIR"
echo "📂 App Directory: $APP_DIR"
echo "👤 User: $CURRENT_USER"

# 1. Update System
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
echo "🟢 Installing Node.js..."
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" ]]; then
    echo "Detected 64-bit architecture."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "Node.js is already installed."
    fi
elif [[ "$ARCH" == "armv7l" ]] || [[ "$ARCH" == "armhf" ]]; then
    echo "Detected 32-bit architecture."
    sudo apt install -y nodejs npm
else
    echo "Unknown architecture: $ARCH. Trying standard install..."
    sudo apt install -y nodejs npm
fi

# 3. Install Utilities
echo "🛠 Installing utilities..."
sudo apt install -y unclutter git

# 4. Install Global NPM Packages
echo "🌐 Installing 'serve'..."
sudo npm install -g serve

# 5. Project Setup
echo "📂 Setting up project dependencies..."
cd "$REPO_DIR"

if [ ! -d "$APP_DIR" ]; then
    echo "❌ App directory not found at: $APP_DIR"
    echo "Expected repo layout: <repo>/dibo-tracker/package.json"
    exit 1
fi

cd "$APP_DIR"

echo "📦 Installing npm dependencies..."
npm install
echo "🏗 Building app..."
npm run build

# Go back to repo root
cd "$REPO_DIR"
chmod +x "$REPO_DIR/start-kiosk.sh"

# 6. Setup Autostart (use both .desktop and lxsession for reliability)
echo "🚀 Configuring Autostart..."
START_SCRIPT="$REPO_DIR/start-kiosk.sh"
AUTOSTART_DESKTOP_DIR="/home/$CURRENT_USER/.config/autostart"
AUTOSTART_DESKTOP="$AUTOSTART_DESKTOP_DIR/dibo-kiosk.desktop"
LXSESSION_DIR="/home/$CURRENT_USER/.config/lxsession/LXDE-pi"
LXSESSION_FILE="$LXSESSION_DIR/autostart"

mkdir -p "$AUTOSTART_DESKTOP_DIR"
mkdir -p "$LXSESSION_DIR"

# Method 1: XDG autostart .desktop file (most reliable, runs when user session starts)
cat > "$AUTOSTART_DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=Dibo Tracker Kiosk
Exec=$START_SCRIPT
X-GNOME-Autostart-enabled=true
EOF
chmod 644 "$AUTOSTART_DESKTOP"
echo "Created $AUTOSTART_DESKTOP"

# Method 2: LXDE-pi autostart (backup for Legacy Pi OS)
if [ ! -f "$LXSESSION_FILE" ]; then
    echo "@lxpanel --profile LXDE-pi" > "$LXSESSION_FILE"
    echo "@pcmanfm --desktop --profile LXDE-pi" >> "$LXSESSION_FILE"
    echo "@xscreensaver -no-splash" >> "$LXSESSION_FILE"
fi
grep -q "@xset s off" "$LXSESSION_FILE" 2>/dev/null || echo "@xset s off" >> "$LXSESSION_FILE"
grep -q "@xset -dpms" "$LXSESSION_FILE" 2>/dev/null || echo "@xset -dpms" >> "$LXSESSION_FILE"
grep -q "@xset s noblank" "$LXSESSION_FILE" 2>/dev/null || echo "@xset s noblank" >> "$LXSESSION_FILE"
if ! grep -q "start-kiosk.sh" "$LXSESSION_FILE" 2>/dev/null; then
    echo "@$START_SCRIPT" >> "$LXSESSION_FILE"
    echo "Added kiosk to LXDE autostart."
fi

# 7. Screen Configuration
echo "🖥 Configuring Screen (Hosyond 7 inch)..."
CONFIG_TXT="/boot/config.txt"

if grep -q "hdmi_cvt 1024 600 60 6 0 0 0" "$CONFIG_TXT"; then
    echo "Screen configuration already present."
else
    echo "Appending screen settings to $CONFIG_TXT..."
    sudo bash -c "cat >> $CONFIG_TXT" <<EOL

# Dibo Tracker Screen Config
hdmi_group=2
hdmi_mode=87
hdmi_cvt 1024 600 60 6 0 0 0
hdmi_drive=1
display_rotate=0
EOL
fi

echo "✅ Setup Complete!"
echo "Please reboot your Pi to start the tracker: sudo reboot"
