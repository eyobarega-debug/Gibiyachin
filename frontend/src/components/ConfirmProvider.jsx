import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog } from "./ui";

const ConfirmContext = createContext(null);

/**
 * Provides an imperative `confirm(options)` helper backed by the shared
 * ConfirmDialog. Usage:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Remove product?", variant: "danger" }))) return;
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ loading: false, ...options });
    });
  }, []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const current = state;
    if (current?.onConfirm) {
      setState((s) => (s ? { ...s, loading: true } : s));
      try {
        await current.onConfirm();
      } finally {
        setState((s) => (s ? { ...s, loading: false } : s));
      }
    }
    close(true);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.title}
        message={state?.message}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        variant={state?.variant}
        loading={state?.loading}
        onConfirm={handleConfirm}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback to the browser dialog if the provider is missing.
    return (options = {}) =>
      Promise.resolve(window.confirm(options.message || options.title || "Are you sure?"));
  }
  return ctx;
}
