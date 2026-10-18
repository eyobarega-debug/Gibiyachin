import { useEffect, useRef } from "react";
import Icon from "./Icon";
import { Badge, Button } from "./ui";

export default function AuthPromptModal({
  open,
  onClose,
  title = "Sign in to Gibiyachin",
  description = "Join your campus community to browse verified listings, borrow & rent equipment, and access QR-verified event tickets.",
  badge = "",
  onLogin,
  onRegister,
  onContinueGuest,
}) {
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
    >
      <div
        ref={panelRef}
        className="glass-panel animate-rise relative my-8 w-full max-w-md overflow-hidden rounded-3xl border border-white/90 bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Decorative mirror background reflections */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/80 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-slate-300/40 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)" }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>

        {/* Brand Icon Header */}
        <div className="relative text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/90 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
            <span className="text-mirror text-2xl font-black">ግ</span>
          </div>

          <h2 id="auth-prompt-title" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            {title ? (
              <>
                Sign in to <span className="text-mirror">Gibiyachin</span>
              </>
            ) : (
              "Sign in to Gibiyachin"
            )}
          </h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            ግቢያችን • University Marketplace
          </p>

          {badge && (
            <div className="mt-3 flex justify-center">
              <Badge tone="accent">
                <Icon name="university" className="mr-1 h-3 w-3 text-slate-600" />
                {badge}
              </Badge>
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        {/* Action Options */}
        <div className="relative mt-7 space-y-3">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={onLogin}
            className="w-full justify-center border-slate-300/90 bg-white hover:bg-slate-50 text-slate-900 font-semibold shadow-xs transition"
          >
            <Icon name="user" className="h-4 w-4 text-slate-700" />
            <span>Log in to your account</span>
          </Button>

          <Button
            type="button"
            size="lg"
            onClick={onRegister}
            className="w-full justify-center bg-[#1c222c] hover:bg-[#2c3545] text-white font-semibold shadow-md transition"
          >
            <Icon name="sparkles" className="h-4 w-4 text-slate-300" />
            <span>Create new account (Sign up)</span>
          </Button>
        </div>

        {/* Dismiss / Continue as guest */}
        <div className="relative mt-5 pt-3 border-t border-slate-200/70 text-center">
          <button
            type="button"
            onClick={onContinueGuest}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-800 hover:decoration-slate-600"
          >
            Continue browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
}

