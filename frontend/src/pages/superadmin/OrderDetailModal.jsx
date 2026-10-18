import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, ErrorBanner, Modal, Spinner } from "../../components/ui";
import OrderStatus from "../../components/OrderStatus";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, fmtDate, fmtMoney, humanize, shortId } from "./constants";

// Read-only order detail (order list/detail endpoints). No payment completion
// logic lives in the frontend — the backend/payment provider owns that.
export default function OrderDetailModal({ open, orderId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    client
      .get(`/orders/${orderId}`)
      .then(({ data: res }) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(errMsg(err, "Could not load the order")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const o = data?.order;

  return (
    <Modal open={open} onClose={onClose} title={o ? `Order #${shortId(o.id)}` : "Order"} size="lg">
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !o ? (
        <p className="text-sm text-muted">Order not found.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_STATUS_TONE[o.status] || "slate"}>{ORDER_STATUS_LABEL[o.status] || humanize(o.status)}</Badge>
            {o.payment_status && (
              <Badge tone={PAYMENT_STATUS_TONE[o.payment_status] || "slate"}>
                Payment: {humanize(o.payment_status)}
              </Badge>
            )}
            <span className="text-sm font-bold text-ink">{fmtMoney(o.total_amount)}</span>
          </div>

          <OrderStatus status={o.status} />

          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Buyer" value={o.buyer_name} />
            <Field label="Store" value={o.store_name} />
            <Field label="Merchant" value={o.merchant_name} />
            <Field label="Created" value={fmtDate(o.created_at)} />
            {data.payment && <Field label="Payment provider" value={humanize(data.payment.provider)} />}
            {data.payment?.confirmedAt && <Field label="Payment confirmed" value={fmtDate(data.payment.confirmedAt)} />}
          </dl>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Items</p>
            <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200/80 bg-white/60">
              {(data.items || []).map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {it.title} <span className="text-muted">× {it.quantity}</span>
                  </span>
                  <span className="font-medium text-ink">{fmtMoney(Number(it.unit_price) * it.quantity)}</span>
                </li>
              ))}
              {(data.items || []).length === 0 && <li className="px-3 py-2 text-sm text-muted">No line items.</li>}
            </ul>
          </div>

          {(data.history || []).length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Status history</p>
              <ol className="space-y-2">
                {data.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-medium text-slate-700">{h.to?.label || h.toStatus}</span>
                    <span>· {fmtDate(h.createdAt)}</span>
                    {h.changedBy?.name && <span>· by {h.changedBy.name} ({humanize(h.changedBy.role)})</span>}
                    {h.note && <span className="text-slate-500">· {h.note}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}
