import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import './Toast.css';

// Lightweight dark toast notification banner
function Toast({ toast, onDismiss }) {
  if (!toast?.message) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`obsidian-toast ${isSuccess ? 'toast-success' : 'toast-error'}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-icon" aria-hidden="true">
        {isSuccess ? <CheckCircle2 size={16} strokeWidth={1.75} /> : <AlertCircle size={16} strokeWidth={1.75} />}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close-btn"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export default Toast;
