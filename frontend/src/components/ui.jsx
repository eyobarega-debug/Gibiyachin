import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  // Primary dark charcoal pill button matching the reference design
  primary:
    "bg-[#1c222c] hover:bg-[#2c3545] text-white shadow-sm shadow-slate-900/10 active:scale-[0.99]",
  accent:
    "bg-[#1c222c] hover:bg-[#2c3545] text-white shadow-sm shadow-slate-900/10 active:scale-[0.99]",
  secondary:
    "border border-white/90 bg-white/80 text-slate-800 hover:bg-white hover:border-slate-300 shadow-sm shadow-slate-900/5",
  outline:
    "border border-slate-300/80 bg-white/50 text-slate-700 hover:bg-white/90 hover:text-slate-900 hover:border-slate-400",
  ghost: "text-muted hover:bg-slate-200/50 hover:text-ink",
  danger:
    "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  success:
    "border border-ok/30 bg-ok/10 text-ok hover:bg-ok/20",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function Button({
  as: As = "button",
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const isNative = As === "button";
  return (
    <As
      className={`${base} ${BUTTON_SIZES[size] || BUTTON_SIZES.md} ${
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary
      } ${className}`}
      disabled={isNative ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 border-slate-300 border-t-current" />}
      {children}
    </As>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({ className = "", interactive = false, children, ...props }) {
  return (
    <div
      className={`glass rounded-2xl ${interactive ? "glass-hover" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ tone = "slate", children, className = "" }) {
  const tones = {
    slate: "border-slate-200/90 bg-slate-100/90 text-slate-700",
    navy: "border-slate-300/80 bg-slate-200/80 text-slate-800",
    accent: "border-slate-300/80 bg-slate-900/5 text-slate-800 font-semibold",
    primary: "border-slate-300/80 bg-slate-900/5 text-slate-800 font-semibold",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${
        tones[tone] || tones.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

function FieldShell({ id, label, required, hint, error, children }) {
  return (
    <div className="block">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_BASE =
  "glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-ink outline-none transition duration-200 disabled:cursor-not-allowed disabled:opacity-60";
const CONTROL_OK = "focus:border-white/35 focus:ring-2 focus:ring-white/15";
const CONTROL_ERR = "border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20";

export function Input({ label, error, hint, required, className = "", id, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className={`${CONTROL_BASE} ${error ? CONTROL_ERR : CONTROL_OK} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({ label, error, hint, required, className = "", id, rows = 3, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className={`${CONTROL_BASE} ${error ? CONTROL_ERR : CONTROL_OK} resize-y ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function Select({ label, error, hint, required, className = "", id, children, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error}>
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className={`${CONTROL_BASE} ${error ? CONTROL_ERR : CONTROL_OK} appearance-none bg-white pr-9 ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, error, hint, required, className = "", id, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
        <input
          id={fieldId}
          type="checkbox"
          required={required}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 bg-white text-[#1c222c] accent-[#1c222c] focus:ring-2 focus:ring-slate-400"
          {...props}
        />
        <span>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      </label>
      {hint && !error && <p className="mt-1 pl-6 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 pl-6 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function Alert({ tone = "info", title, children, onClose, className = "" }) {
  const tones = {
    info: "border-info/25 bg-info/10 text-info",
    success: "border-ok/25 bg-ok/10 text-ok",
    warn: "border-warn/25 bg-warn/10 text-warn",
    error: "border-danger/25 bg-danger/10 text-danger",
  };
  const icons = { info: "info", success: "checkCircle", warn: "alert", error: "alert" };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur-sm ${tones[tone] || tones.info} ${className}`}
    >
      <Icon name={icons[tone] || "info"} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({ message, title, onClose }) {
  if (!message) return null;
  return (
    <Alert tone="error" title={title} onClose={onClose}>
      {message}
    </Alert>
  );
}

export function SuccessBanner({ message, title, onClose }) {
  if (!message) return null;
  return (
    <Alert tone="success" title={title} onClose={onClose}>
      {message}
    </Alert>
  );
}

/* ------------------------------------------------------------------ */
/* Empty + page structure                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, subtitle, action, icon, className = "" }) {
  return (
    <div
      className={`glass-soft flex flex-col items-center justify-center gap-2 rounded-2xl border-dashed border-slate-300 px-6 py-16 text-center ${className}`}
    >
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/60 text-slate-600">
        {icon && typeof icon === "string" ? <Icon name={icon} className="h-6 w-6" /> : icon || <Icon name="sparkles" className="h-6 w-6" />}
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-muted">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.to && !last ? (
                <a href={item.to} className="transition hover:text-ink">
                  {item.label}
                </a>
              ) : (
                <span className={last ? "font-medium text-slate-800" : ""}>{item.label}</span>
              )}
              {!last && <span className="text-slate-400">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, action, breadcrumbs, className = "" }) {
  return (
    <div className={`mb-6 ${className}`}>
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export function Tabs({ items = [], value, onChange, className = "" }) {
  return (
    <div
      className={`flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-200/40 p-1.5 ${className}`}
      role="tablist"
    >
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(t.key)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition duration-200 ${
              active
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-muted hover:bg-white/60 hover:text-ink"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  active ? "bg-slate-100 text-slate-800" : "bg-slate-200/60 text-muted"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function Table({ head = [], children, className = "" }) {
  return (
    <div className={`thin-scrollbar overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm ${className}`}>
      <table className="w-full min-w-[560px] border-collapse text-sm">
        {head.length > 0 && (
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              {head.map((h, i) => (
                <th key={i} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-200/60">{children}</tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal + confirmation dialog                                         */
/* ------------------------------------------------------------------ */

const MODAL_SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md", className = "" }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-md sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        className={`glass-panel animate-rise my-8 w-full ${MODAL_SIZES[size] || MODAL_SIZES.md} overflow-hidden rounded-2xl shadow-2xl ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-3.5">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink"
              aria-label="Close"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 bg-slate-50/70 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Glass aliases (documented component names)                          */
/* ------------------------------------------------------------------ */

export const GlassCard = Card;
