import Icon from "./Icon";

const STEPS = [
  { key: "pending_payment", label: "Pending", icon: "clock" },
  { key: "confirmed", label: "Paid", icon: "wallet" },
  { key: "ready", label: "Ready for Pickup", icon: "products" },
  { key: "completed", label: "Completed", icon: "checkCircle" },
];

const ORDER_INDEX = {
  pending_payment: 0,
  confirmed: 1,
  ready: 2,
  completed: 3,
};

/**
 * Premium glass progress timeline for marketplace orders.
 * Reads real order statuses only — pending_payment | confirmed | ready |
 * completed, with cancelled / cancellation_requested shown as a terminal state.
 */
export default function OrderStatus({ status, className = "" }) {
  if (status === "cancelled" || status === "cancellation_requested") {
    const cancelled = status === "cancelled";
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
          cancelled ? "border-danger/25 bg-danger/10" : "border-warn/25 bg-warn/10"
        } ${className}`}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            cancelled ? "bg-danger/20 text-danger" : "bg-warn/20 text-warn"
          }`}
        >
          <Icon name={cancelled ? "close" : "clock"} className="h-4 w-4" />
        </span>
        <div>
          <p className={`text-sm font-semibold ${cancelled ? "text-danger" : "text-warn"}`}>
            {cancelled ? "Order cancelled" : "Cancellation requested"}
          </p>
          <p className="text-xs text-muted">
            {cancelled ? "This order will not be fulfilled." : "Awaiting merchant confirmation."}
          </p>
        </div>
      </div>
    );
  }

  const current = ORDER_INDEX[status] ?? 0;

  return (
    <div className={`flex items-start ${className}`} role="list" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center" role="listitem">
            <div className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : done || active ? "bg-slate-300" : "bg-slate-200"}`}
              />
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                  done
                    ? "border-slate-800 bg-[#1c222c] text-white shadow-xs"
                    : active
                      ? "border-slate-800 bg-white text-slate-900 shadow-md ring-4 ring-slate-200/60"
                      : "border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                <Icon name={done ? "check" : step.icon} className="h-4 w-4" />
              </span>
              <span
                className={`h-0.5 flex-1 ${
                  i === STEPS.length - 1 ? "bg-transparent" : done ? "bg-slate-300" : "bg-slate-200"
                }`}
              />
            </div>
            <span
              className={`mt-2 px-1 text-center text-[11px] font-medium ${
                active ? "text-slate-900 font-semibold" : done ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
