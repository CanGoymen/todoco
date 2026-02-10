import { useEffect } from "react";

export function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast">
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} type="button" aria-label="Close">
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}
