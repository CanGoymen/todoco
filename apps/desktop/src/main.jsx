import React from "react";
import { createRoot } from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { App } from "./App.jsx";
import "./styles.css";

document.body.dataset.page = "popup";
document.body.dataset.trayArrow = "top"; // default: macOS

listen("tray-arrow", (event) => {
  document.body.dataset.trayArrow = event.payload; // "top" or "bottom"
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
