# Dibo Tracker 🐶

A dog walk and feeding tracker for Dibo, designed for a Raspberry Pi touch screen.

## Features
- **Last Fed**: Tracks the last feeding time.
- **Last Walk**: Tracks the last walk time.
- **Good Boy Meter**: A fun meter to track Dibo's behavior.
- **Touch-friendly UI**: Large buttons and clear text for 7" touch screens (1024x600).
- **Vietnamese Interface**: All text is in Vietnamese.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Date Formatting**: date-fns (Vietnamese locale)
- **Backend**: Firebase (Firestore)

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Firebase**:
    - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    - Enable **Firestore Database**.
    - Copy your web app configuration.
    - Open `src/lib/firebase.ts` and replace the placeholder config with your own.

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Build for Production**:
    ```bash
    npm run build
    ```

## Running on Raspberry Pi

1.  **Build the app** on your computer.
2.  **Transfer the `dist` folder** to your Raspberry Pi.
3.  **Serve the app**:
    You can use `serve` or any static file server.
    ```bash
    npm install -g serve
    serve -s dist -l 3000
    ```
4.  **Open in Kiosk Mode**:
    Open Chromium on the Pi:
    ```bash
    chromium-browser --kiosk http://localhost:3000
    ```

## Hardware Support
Optimized for 7" Raspberry Pi Touch Screen (1024x600).
Works with Raspberry Pi 4B (Recommended) and Zero 2 W.
