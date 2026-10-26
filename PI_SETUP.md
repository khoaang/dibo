# Pi setup

The kiosk is a Raspberry Pi 4B with a Hosyond 7" HDMI touchscreen (1024x600). Plug
the screen's HDMI into the Pi's HDMI0 port (the one next to the power port), and its
touch USB cable into any USB port.

## OS

Flash Raspberry Pi OS (64-bit, with desktop) using Raspberry Pi Imager. In its
settings, set the hostname to `dibo-pi`, turn on SSH, and set up Wi-Fi, a user and
the time zone. Get the time zone right, since the day reset and the theme go off the
Pi's local time.

The default Bookworm desktop (Wayland) works. The app scales to whatever resolution
the Pi sends, so it fills the screen even though Bookworm drives this panel at 1080p
and lets the panel scale it down.

## Install

```bash
git clone https://github.com/khoaang/dibo.git ~/dibo
```

Copy your `.env` over from your computer, or the kiosk won't sync:

```bash
scp dibo-tracker/.env <user>@dibo-pi.local:~/dibo/dibo-tracker/
```

Then on the Pi:

```bash
cd ~/dibo
./setup-pi.sh
sudo reboot
```

`setup-pi.sh` installs Node, `serve` and `unclutter`, builds the app, and sets up
autostart. Rerunning it is harmless.

After that, `start-kiosk.sh` runs on every login. It waits for the clock to sync,
pulls `main` and rebuilds if anything changed, serves the app on port 3000, and keeps
Chromium open in kiosk mode. It logs to `/tmp/dibo-kiosk.log`.

## Updating

Push to `main` and reboot the Pi. To update without rebooting:

```bash
cd ~/dibo && git pull
cd dibo-tracker && npm ci && npm run build
pkill -f chromium   # the kiosk loop reopens it
```

Stick to `npm ci` on the Pi. `npm install` can modify `package-lock.json`, and the
boot script stops pulling once the checkout has local changes.

## Troubleshooting

Check `/tmp/dibo-kiosk.log` first.

If the Pi boots to the desktop, run `./setup-pi.sh` again and reboot.

If the log says "Local changes detected", run `git status` on the Pi. If it's only
`package-lock.json`, run `git checkout -- . && git pull` and reboot.

"Offline" on the screen means `.env` is missing on the Pi. "Not syncing" usually
means the Firestore rules are rejecting it, and Settings shows the actual error.

On older Raspberry Pi OS releases (Bullseye and earlier), the resolution comes from
the `hdmi_cvt 1024 600 60 6 0 0 0` line that `setup-pi.sh` adds to `config.txt`.
Bookworm ignores it.

Running `start-kiosk.sh` by hand does nothing while the kiosk is already running,
because of the lock file.

To skip the password when you SSH in, run `ssh-copy-id <user>@dibo-pi.local` from
your computer. After that you can turn off password logins in
`/etc/ssh/sshd_config`.
