import { Card } from "./ui";

/**
 * Shared shell for the authentication screens (login, register, OTP,
 * forgot/reset password) so every auth page has the same brand, heading and
 * card treatment.
 */
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto w-full max-w-md py-8 sm:py-14">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/90 bg-white/90 text-xl font-bold text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
          ግ
        </span>
        <span className="mt-3 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
          Gibiyachin
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{subtitle}</p>}
      </div>

      <Card className="border border-white/90 bg-white/80 p-6 shadow-xl sm:p-7">{children}</Card>

      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
