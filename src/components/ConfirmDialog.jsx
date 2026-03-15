import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = 'bg-danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-bg-secondary rounded-2xl border border-border p-5 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button onClick={onCancel} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-text-secondary">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onCancel} className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`${confirmColor} text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
