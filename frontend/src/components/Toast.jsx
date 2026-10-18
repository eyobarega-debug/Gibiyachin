import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = "info", duration = 4000) => {
      const id = ++seq;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (m, d) => push(m, "success", d),
      error: (m, d) => push(m, "error", d),
      info: (m, d) => push(m, "info", d),
      warn: (m, d) => push(m, "warn", d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }) {
  const tones = {
    info: "border-info/25 glass-strong text-ink",
    success: "border-ok/30 glass-strong text-ink",
    warn: "border-warn/30 glass-strong text-ink",
    error: "border-danger/30 glass-strong text-ink",
  };
  const bars = {
    info: "bg-info",
    success: "bg-ok",
    warn: "bg-warn",
    error: "bg-danger",
  };
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-stretch gap-3 overflow-hidden rounded-xl border shadow-lg ${
        tones[toast.tone] || tones.info
      }`}
    >
      <span className={`w-1.5 shrink-0 ${bars[toast.tone] || bars.info}`} />
      <p className="flex-1 py-3 pr-2 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="px-3 text-muted transition hover:text-ink"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so components can be used without the provider.
    return { toast() {}, success() {}, error() {}, info() {}, warn() {} };
  }
  return ctx;
}
