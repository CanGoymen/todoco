import { useState } from "react";

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function ShareModal({ isOpen, onClose, workspaceName, workspaceSecret }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleCopyAll() {
    const text = `Workspace: ${workspaceName}\nSecret: ${workspaceSecret}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Share Workspace</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="share-description">Share these details with your team to let them join your workspace</p>

          <div className="workspace-info-card">
            <div className="workspace-info-row">
              <div className="workspace-info-label">Workspace:</div>
              <div className="workspace-info-value">{workspaceName}</div>
            </div>
            <div className="workspace-info-row">
              <div className="workspace-info-label">Secret:</div>
              <div className="workspace-info-value">
                <span className="workspace-secret-code">{workspaceSecret}</span>
              </div>
            </div>
          </div>

          {copied && <p className="copy-success">Copied to clipboard!</p>}
        </div>
        <div className="modal-footer">
          <button className="modal-button-primary" onClick={handleCopyAll}>
            Copy All
          </button>
          <button className="modal-button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export { ShareIcon };
