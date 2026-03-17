import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const icons = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Mark toast as exiting for animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Remove after exit animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), 3000);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[998] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => {
            const Icon = icons[t.type] || icons.info;
            const color = colors[t.type] || colors.info;
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-center gap-2.5 max-w-[300px] px-3.5 py-2.5 rounded-xl bg-bg-secondary border border-border card-shadow-lg`}
                style={{ animation: t.exiting ? 'toastOut 200ms ease-in forwards' : 'toastIn 250ms ease-out' }}
              >
                <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                <span className="text-sm text-text-primary flex-1 leading-snug">{t.message}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  className="p-0.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
