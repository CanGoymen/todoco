import { useState } from "react";

function initials(name) {
  if (name === "ALL") {
    return "ALL";
  }

  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function AvatarFilterBar({ options, active, onChange, loggedInUserId, onlineUsers = [], idleUsers = [], dndUsers = [], userStatuses = {}, userLocations = {}, isDnd = false, isConnected, isIdle }) {
  const [tooltip, setTooltip] = useState(null);

  function getPresenceClass(optionId) {
    if (optionId === "all") {
      return "";
    }
    if (optionId === loggedInUserId) {
      if (!isConnected) return "offline";
      if (isDnd) return "dnd";
      return isIdle ? "idle" : "online";
    }
    // Other users: check server-side lists
    if (!onlineUsers.includes(optionId)) return "offline";
    if (dndUsers.includes(optionId)) return "dnd";
    return idleUsers.includes(optionId) ? "idle" : "online";
  }

  function showTooltip(e, text) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 2 });
  }

  return (
    <>
      <div className="avatar-bar">
        {options.map((option) => {
          const presenceClass = getPresenceClass(option.id);
          const nonMemberClass = option.isWorkspaceMember === false ? "non-member" : "";
          const status = option.id !== "all" ? userStatuses[option.id] : null;
          const location = option.id !== "all" ? userLocations[option.id] : null;
          const nameLine = status?.text
            ? `${option.label}${status.emoji ? ` ${status.emoji}` : ""} ${status.text}`
            : option.label;
          const tooltipText = location ? `${nameLine}\n📍 ${location}` : nameLine;
          return (
            <button
              key={option.id}
              className={`avatar-pill ${active === option.id ? "active" : ""} ${presenceClass} ${nonMemberClass}`}
              onClick={() => onChange(option.id)}
              type="button"
              onMouseEnter={(e) => showTooltip(e, tooltipText)}
              onMouseLeave={() => setTooltip(null)}
            >
              {option.avatar_base64 ? (
                <img
                  src={option.avatar_base64}
                  alt={option.label}
                  className="avatar-pill-img"
                />
              ) : (
                initials(option.label)
              )}
              {status?.emoji ? (
                <span className="avatar-status-emoji">{status.emoji}</span>
              ) : status?.text ? (
                <span className="avatar-status-emoji avatar-status-chat">
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9.586a1 1 0 0 1 .707.293l2.853 2.853a.5.5 0 0 0 .854-.353V4a2 2 0 0 0-2-2H2z"/>
                  </svg>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tooltip && (
        <div
          className="avatar-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
