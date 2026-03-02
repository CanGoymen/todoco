import { useEffect, useState } from "react";

const PRESETS = [
  { emoji: "📅", text: "In a meeting" },
  { emoji: "🏠", text: "Working from home" },
  { emoji: "🎯", text: "Focus time" },
  { emoji: "☕", text: "Taking a break" },
  { emoji: "🍽", text: "Out for lunch" },
  { emoji: "🌴", text: "Vacation" },
  { emoji: "🤒", text: "Sick" },
  { emoji: "🚫", text: "Do not disturb" },
];

const PRESENCE_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "away",   label: "Away"   },
  { key: "dnd",    label: "DND"    },
];

export function StatusModal({ presence, statusEmoji, statusText, isDnd, onSave, onClear, onClose }) {
  const [localEmoji,    setLocalEmoji]    = useState(statusEmoji || "");
  const [localText,     setLocalText]     = useState(statusText  || "");
  const [localPresence, setLocalPresence] = useState(
    isDnd ? "dnd" : presence === "away" ? "away" : "active"
  );
  const [presetsOpen, setPresetsOpen] = useState(false);

  useEffect(() => {
    function onEsc(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function handlePresetSelect(emoji, text) {
    const presenceOverride = text === "Do not disturb" ? "dnd" : localPresence;
    onSave({ emoji, text, presenceOverride });
    onClose();
  }

  function handlePresenceSelect(key) {
    onSave({ emoji: localEmoji, text: localText, presenceOverride: key });
    onClose();
  }

  function handleTextSubmit() {
    onSave({ emoji: localEmoji, text: localText, presenceOverride: localPresence });
    onClose();
  }

  const hasStatus = localEmoji || localText.trim();

  return (
    <div className="status-panel">
      <div className="status-input-row">
        <button
          className={`status-emoji-btn ${presetsOpen ? "open" : ""}`}
          type="button"
          title="Quick statuses"
          onClick={() => setPresetsOpen((o) => !o)}
        >
          {localEmoji || "💬"}
        </button>
        <input
          className="status-text-input"
          type="text"
          placeholder="Set a status…"
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value);
            if (!e.target.value) setLocalEmoji("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleTextSubmit(); }
          }}
          maxLength={80}
          autoFocus
        />
        {hasStatus && (
          <button
            className="status-reset-btn"
            type="button"
            title="Clear status"
            onClick={() => { onClear(); onClose(); }}
          >
            ✕
          </button>
        )}
      </div>

      {presetsOpen && (
        <div className="status-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.text}
              className="status-preset-item"
              type="button"
              onClick={() => handlePresetSelect(preset.emoji, preset.text)}
            >
              <span className="preset-emoji">{preset.emoji}</span>
              <span className="preset-text">{preset.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className="presence-selector">
        {PRESENCE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`presence-option ${localPresence === key ? "selected" : ""}`}
            onClick={() => handlePresenceSelect(key)}
          >
            <span className={`presence-dot presence-dot-${key}`} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
