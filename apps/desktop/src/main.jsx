import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  document.documentElement.dataset.mobile = "true";
  document.body.dataset.page = "mobile";

  // Prevent iOS auto-zoom on input focus (font-size < 16px triggers zoom)
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
  }
} else {
  document.body.dataset.page = "popup";
  document.body.dataset.trayArrow = "top"; // default: macOS

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen("tray-arrow", (event) => {
      document.body.dataset.trayArrow = event.payload; // "top" or "bottom"
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
