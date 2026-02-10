import { useState, useEffect } from "react";
import { getCustomServerSettings, saveCustomServerSettings } from "../lib/config.js";

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function validateServerUrl(url) {
  if (!url.trim()) {
    return "Server URL is required";
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return "URL must start with http:// or https://";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

function validateToken(token) {
  if (!token.trim()) {
    return "Token is required";
  }
  if (token.length < 3) {
    return "Token must be at least 3 characters";
  }
  return null;
}

export function SettingsModal({ isOpen, onClose, onSave }) {
  const [customServerEnabled, setCustomServerEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState({});

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      const settings = getCustomServerSettings();
      setCustomServerEnabled(settings.enabled);
      setServerUrl(settings.server);
      setToken(settings.token);
      setErrors({});
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleChange = (e) => {
    const enabled = e.target.checked;
    setCustomServerEnabled(enabled);
    if (!enabled) {
      setErrors({});
    }
  };

  const handleSave = () => {
    // Validate inputs if custom server is enabled
    if (customServerEnabled) {
      const newErrors = {};

      const serverError = validateServerUrl(serverUrl);
      if (serverError) newErrors.server = serverError;

      const tokenError = validateToken(token);
      if (tokenError) newErrors.token = tokenError;

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }

    // Save settings (workspace will be handled by registration flow)
    try {
      saveCustomServerSettings(customServerEnabled, serverUrl, token, "");
      onSave();
    } catch (error) {
      console.error("Failed to save settings:", error);
      setErrors({ general: "Failed to save settings" });
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="settings-section">
          <div className="toggle-row">
            <span className="toggle-label">Custom Server</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={customServerEnabled}
                onChange={handleToggleChange}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="server-url">
              Server
            </label>
            <input
              id="server-url"
              type="text"
              className={`settings-input ${errors.server ? "error" : ""}`}
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                if (errors.server) {
                  setErrors({ ...errors, server: null });
                }
              }}
              disabled={!customServerEnabled}
              placeholder="http://localhost:8787"
            />
            {errors.server && (
              <div className="settings-error">{errors.server}</div>
            )}
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="token">
              Token
            </label>
            <input
              id="token"
              type="text"
              className={`settings-input ${errors.token ? "error" : ""}`}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (errors.token) {
                  setErrors({ ...errors, token: null });
                }
              }}
              disabled={!customServerEnabled}
              placeholder="abcd1234..."
            />
            {errors.token && (
              <div className="settings-error">{errors.token}</div>
            )}
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="settings-button primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export { SettingsIcon };
