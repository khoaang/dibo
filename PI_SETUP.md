# Raspberry Pi setup

This is how the kiosk is set up: a Raspberry Pi 4B behind a Hosyond 7" HDMI
touchscreen (1024x600), opening Dibo full-screen on boot.

## Hardware

Connect the Pi's HDMI0 port (the micro-HDMI port next to USB-C power) to the
screen's HDMI input. Then connect the screen's Touch port to any USB port on the Pi.
Touch needs that USB connection; the screen can also draw power from it.

## Flash the SD card

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) with Raspberry Pi
OS (64-bit, with desktop). In the customization settings:

- hostname: `dibo-pi`
- a username and password of your choice (the scripts work with any user)
- your Wi-Fi
- your time zone, which matters: the 3am day reset and the day/night theme both use
  the Pi's local time
- SSH on, so you can update and debug it without a keyboard

The kiosk scripts use X11 tools to hide the cursor and keep the screen awake. On
Bookworm, switch the desktop to X11 after first boot with `sudo raspi-config` →
Advanced Options → Wayland → X11, then reboot. The Legacy (Bullseye) image already
uses X11.

## Install

On the Pi:

```bash
git clone https://github.com/khoaang/dibo.git ~/dibo
```

Copy your Firebase config over from your computer. Without it, the kiosk runs offline
and doesn't sync:

```bash
scp dibo-tracker/.env <user>@dibo-pi.local:~/dibo/dibo-tracker/.env
```

Then run the setup script and reboot:

```bash
cd ~/dibo
./setup-pi.sh
sudo reboot
```

`setup-pi.sh` updates the system, installs Node.js, `git`, `unclutter` and `serve`,
builds the app, sets up autostart, and adds the screen resolution to `config.txt`.
It's safe to run again.

## How it starts

On login, `start-kiosk.sh`:

1. waits for the desktop, then for the clock to sync (the Pi has no hardware clock,
   so it boots with a stale time),
2. pulls `main` and rebuilds if there's anything new, unless the checkout has local
   changes,
3. serves `dibo-tracker/dist` on `localhost:3000`,
4. opens Chromium in kiosk mode and reopens it if it closes or crashes, restarting
   the server too if it died.

Everything it does goes to `/tmp/dibo-kiosk.log`.

## Updating

Push to `main`, then reboot the Pi.

To update without a reboot:

```bash
cd ~/dibo && git pull
cd dibo-tracker && npm ci && npm run build
pkill -f chromium   # the kiosk loop reopens it on the new build
```

Use `npm ci`, not `npm install`. `npm install` can rewrite `package-lock.json`, and
once the checkout has local changes the boot script stops pulling updates.

## When something's wrong

Start with the log:

```bash
cat /tmp/dibo-kiosk.log
```

- **Pi boots to the desktop instead of the kiosk.** Run `./setup-pi.sh` again and
  reboot. Check that `~/.config/autostart/dibo-kiosk.desktop` exists.
- **Log says "Local changes detected, skipping auto-update".** Something modified the
  checkout. `git status` shows what. If it's only `package-lock.json`, run
  `git checkout -- . && git pull` and reboot.
- **Screen says "Offline".** `dibo-tracker/.env` is missing on the Pi. Copy it over
  and rebuild.
- **Screen says "Not syncing".** Usually the Firestore rules are rejecting requests.
  Settings shows the exact error.
- **Black bars or a blurry picture.** Check that `config.txt` (in `/boot/firmware/`
  on Bookworm, `/boot/` on older releases) ends with:

  ```ini
  hdmi_group=2
  hdmi_mode=87
  hdmi_cvt 1024 600 60 6 0 0 0
  hdmi_drive=1
  ```

Running `./start-kiosk.sh` by hand only works when the kiosk isn't already running.
Otherwise it sees the lock and exits right away.

## SSH

Set up a key so you don't need the password:

```bash
ssh-copy-id <user>@dibo-pi.local
```

Once that works, it's worth turning off password logins: set
`PasswordAuthentication no` in `/etc/ssh/sshd_config`, then run
`sudo systemctl restart ssh`.
