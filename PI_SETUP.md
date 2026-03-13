# Raspberry Pi 4B Setup Guide for Dibo Tracker

This guide will help you set up your Raspberry Pi 4B with the Hosyond 7" Touch Screen to run the Dibo Tracker automatically on boot.

## 1. Hardware Setup
1.  **Mount the Pi**: Attach your Raspberry Pi 4B to the back of the screen if possible, or place it securely nearby.
2.  **Connect HDMI**:
    *   The Raspberry Pi 4B uses **Micro-HDMI** ports.
    *   Use the **Micro-HDMI to HDMI adapter** (or cable) to connect the Pi's Micro-HDMI port (use **HDMI0**, the one closest to the USB-C power port) to the screen's HDMI port.
3.  **Connect Touch**: Use the Micro-USB cable to connect the screen's "Touch" port to one of the Pi's USB ports (USB 2.0 or 3.0 works fine).
4.  **Power**: Connect your USB-C power supply to the Pi's power port. The screen will draw power from the Pi via the USB connection, or you can power the screen separately if needed (but the USB data connection is mandatory for touch).

## 2. OS Installation
1.  Download and install the [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2.  Insert your microSD card into your computer.
3.  **Choose OS**: Select **Raspberry Pi OS (Legacy, 64-bit) Desktop**.
    *   *Why Legacy?* While the Pi 4B runs the standard Wayland-based OS well, the **Legacy (X11)** version is much easier to configure for simple kiosk scripts (using `unclutter` and display commands).
4.  **Settings (Gear Icon)**:
    *   Set hostname: `dibo-pi`
    *   Enable SSH (optional, but recommended for remote management).
    *   Set username: `pi`
    *   Set password: `your_password`
    *   Configure Wireless LAN: Enter your WiFi SSID and Password.
    *   Set locale settings (Time zone: Asia/Ho_Chi_Minh, Keyboard: US).
5.  **Write**: Flash the OS to the card.

## 3. First Boot & Configuration
1.  Insert the SD card into the Pi and power it up.
2.  Wait for it to boot.
3.  Open a Terminal on the Pi (or SSH in).
4.  **Update System**:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
5.  **Install Node.js**:
    *   **Check Architecture**: Run `uname -m`.
    *   **If `aarch64` (64-bit)**:
        ```bash
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ```
    *   **If `armv7l` (32-bit)**:
        The NodeSource script doesn't support 32-bit. Use the system packages instead (Node 18 is sufficient):
        ```bash
        sudo apt install -y nodejs npm
        ```
6.  **Install Utilities**:
    We need `unclutter` to hide the mouse cursor and `git` to download the code.
    ```bash
    sudo apt install -y unclutter git
    ```
7.  **Install Serve**:
    A simple web server to serve the app.
    ```bash
    sudo npm install -g serve
    ```

## 4. Screen Configuration (If Needed)
If the screen resolution looks wrong (black bars or fuzzy), you need to edit `/boot/config.txt`.
1.  Open the config file:
    ```bash
    sudo nano /boot/config.txt
    ```
2.  Add the following lines to the end of the file (based on Hosyond 7" specs):
    ```ini
    hdmi_group=2
    hdmi_mode=87
    hdmi_cvt 1024 600 60 6 0 0 0
    hdmi_drive=1
    ```
3.  Save and exit (`Ctrl+X`, then `Y`, then `Enter`).
4.  Reboot: `sudo reboot`.

## 5. Deploy the App

1.  **Install Git (if needed)**:
    Most Pi images have it, but just in case:
    ```bash
    sudo apt install -y git
    ```

2.  **Clone the Repository**:
    Clone the project directly from GitHub to your Pi using the repo name `dibo`.
    ```bash
    cd /home/<your-user>
    git clone https://github.com/khoaang/dibo.git
    ```

3.  **Run the Setup Script**:
    Enter the directory and run the automated setup script.
    ```bash
    cd dibo
    chmod +x setup-pi.sh
    ./setup-pi.sh
    ```

4.  **Reboot**:
    Once the script finishes, reboot your Pi.
    ```bash
    sudo reboot
    ```

## 6. Maintenance (Auto-Updates)
The app will now **automatically update** every time you reboot the Pi.
1.  Push your changes to GitHub.
2.  Reboot the Pi (`sudo reboot`).
3.  The Pi will pull the latest code, rebuild, and launch the new version.

If you need to update manually without rebooting:
1.  SSH into the Pi.
2.  `cd /home/<your-user>/dibo`
3.  `./start-kiosk.sh` (This will run the update logic)

## 7. Persistent Kiosk Startup (Important)
If the Pi ever falls back to the Raspberry Pi desktop, run this once to apply the newest self-recovery startup logic:

```bash
cd /home/<your-user>/dibo
git pull
chmod +x setup-pi.sh start-kiosk.sh
./setup-pi.sh
sudo reboot
```

What this now does:
- Automatically relaunches Chromium if it is closed or crashes.
- Restarts the local web server if it stops.
- Prevents duplicate kiosk sessions on startup.
- Re-applies `xset` power settings so the display does not blank/lock.
- Uses both XDG autostart (`.desktop`) and LXDE autostart for reliability.
- Waits for the X display to be ready before launching (avoids early-exit on slow boot).

## 8. Troubleshooting: App Doesn't Open on Boot
If the app doesn't start automatically after reboot:

1. **Check the log** (output is written here):
   ```bash
   cat /tmp/dibo-kiosk.log
   ```

2. **Confirm autostart is configured**:
   ```bash
   ls -la ~/.config/autostart/dibo-kiosk.desktop
   cat ~/.config/autostart/dibo-kiosk.desktop
   ```

3. **Re-run setup and reboot**:
   ```bash
   cd ~/dibo
   ./setup-pi.sh
   sudo reboot
   ```

4. **Manual test** (to verify the script works):
   ```bash
   cd ~/dibo
   ./start-kiosk.sh
   ```
