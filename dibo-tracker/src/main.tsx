import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App.tsx";
import { themeForTime } from "./lib/theme";

// Set before the first paint so the kiosk doesn't flash the light theme when it boots at night.
document.documentElement.dataset.theme = themeForTime(new Date());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
