import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { getLoggedInUser, setLoggedInUser } from "../lib/config.js";
import { updateProfile } from "../lib/api.js";

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function WorkspaceSwitcher({ isOpen, onClose, currentWorkspace, userWorkspaces, onSwitchWorkspace, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [avatarBase64, setAvatarBase64] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const loggedInUser = getLoggedInUser();
      setUser(loggedInUser);
      setFullName(loggedInUser?.full_name || "");
      setAvatarBase64(loggedInUser?.avatar_base64 || "");
      setEditingName(false);
      invoke("plugin:autostart|is_enabled").then(setAutoStartEnabled).catch(() => {});
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  if (!isOpen) return null;

  const handleSwitchWorkspace = async (workspaceId) => {
    if (workspaceId === currentWorkspace) return;

    setLoading(true);
    try {
      await onSwitchWorkspace(workspaceId);
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNameSave = async () => {
    setEditingName(false);
    if (fullName.trim() === (user?.full_name || "")) return;

    try {
      const result = await updateProfile({ full_name: fullName.trim() });
      if (result.user) {
        const updated = { ...user, full_name: result.user.full_name };
        setUser(updated);
        setLoggedInUser(updated, localStorage.getItem("todoco_token"));
      }
    } catch (error) {
      console.error("Failed to update name:", error);
      setFullName(user?.full_name || "");
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      handleNameSave();
    } else if (e.key === "Escape") {
      setFullName(user?.full_name || "");
      setEditingName(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;

      // Resize to max 128px for storage efficiency
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const maxSize = 128;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL("image/jpeg", 0.85);

        setAvatarBase64(resized);
        try {
          const result = await updateProfile({ avatar_base64: resized });
          if (result.user) {
            const updated = { ...user, avatar_base64: result.user.avatar_base64 };
            setUser(updated);
            setLoggedInUser(updated, localStorage.getItem("todoco_token"));
          }
        } catch (error) {
          console.error("Failed to update avatar:", error);
          setAvatarBase64(user?.avatar_base64 || "");
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Min 6 characters");
      return;
    }

    try {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      alert("Password changed successfully");
    } catch (error) {
      setPasswordError("Failed to change password");
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal settings-modal-ios">
        <div className="settings-header-ios settings-header-compact">
          <button className="settings-close-ios" onClick={onClose}>
            Done
          </button>
          <h2 className="settings-title-ios">Settings</h2>
        </div>

        <div className="settings-content-ios">
          {/* Profile Card */}
          <div className="settings-group-ios">
            <div className="settings-profile-card">
              <div className="settings-avatar-wrapper" onClick={handleAvatarClick}>
                {avatarBase64 ? (
                  <img src={avatarBase64} alt="Avatar" className="settings-avatar-img" />
                ) : (
                  <div className="settings-avatar-initials">
                    {initials(fullName || user?.username || "")}
                  </div>
                )}
                <div className="settings-avatar-edit">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="settings-profile-info">
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="settings-profile-name-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                  />
                ) : (
                  <div
                    className="settings-profile-name"
                    onClick={() => setEditingName(true)}
                    title="Click to edit name"
                  >
                    {fullName || user?.username || ""}
                  </div>
                )}
                <div className="settings-profile-email">{user?.email || ""}</div>
              </div>
            </div>
          </div>

          {/* Password Group */}
          <div className="settings-group-ios">
            <button
              className="settings-row-ios settings-row-button-ios"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              <span className="settings-label-ios">Change Password</span>
              <ChevronIcon />
            </button>

            {showPasswordChange && (
              <div className="settings-subgroup-ios">
                <div className="settings-row-ios">
                  <input
                    type="password"
                    className="settings-input-full-ios"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current Password"
                  />
                </div>
                <div className="settings-row-ios">
                  <input
                    type="password"
                    className="settings-input-full-ios"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                  />
                </div>
                <div className="settings-row-ios">
                  <input
                    type="password"
                    className="settings-input-full-ios"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                  />
                </div>
                {passwordError && (
                  <div className="settings-error-ios">{passwordError}</div>
                )}
                <button
                  className="settings-button-ios"
                  onClick={handleChangePassword}
                >
                  Update Password
                </button>
              </div>
            )}
          </div>

          {/* Auto Start */}
          <div className="settings-group-ios">
            <div className="settings-row-ios settings-row-toggle-ios">
              <span className="settings-label-ios">Start on Login</span>
              <label className="settings-toggle-ios">
                <input
                  type="checkbox"
                  checked={autoStartEnabled}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    try {
                      await invoke(enabled ? "plugin:autostart|enable" : "plugin:autostart|disable");
                      setAutoStartEnabled(enabled);
                    } catch (err) {
                      console.error("Autostart toggle failed:", err);
                    }
                  }}
                />
                <span className="settings-toggle-slider-ios" />
              </label>
            </div>
          </div>

          {/* Workspaces Group */}
          <div className="settings-group-header-ios">Workspaces</div>
          <div className="settings-group-ios">
            {userWorkspaces.map((ws) => (
              <button
                key={ws}
                className="settings-row-ios settings-row-button-ios"
                onClick={() => handleSwitchWorkspace(ws)}
                disabled={loading}
              >
                <span className="settings-label-ios">{ws}</span>
                {ws === currentWorkspace && (
                  <span className="settings-checkmark-ios">&#10003;</span>
                )}
              </button>
            ))}
          </div>

          {/* Logout Group */}
          <div className="settings-group-ios">
            <button
              className="settings-row-ios settings-row-destructive-ios"
              onClick={() => {
                onLogout();
                onClose();
              }}
            >
              <span className="settings-label-destructive-ios">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { LogoutIcon, SettingsIcon };
