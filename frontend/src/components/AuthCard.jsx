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
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-white to-[#c3ccd8] text-xl font-bold text-[#0b0d11] shadow-lg">
          ግ
        </span>
        <span className="mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-muted">
          Gibiyachin
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-sm text-sm text-muted">{subtitle}</p>}
      </div>

      <Card className="p-6 sm:p-7">{children}</Card>

      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
