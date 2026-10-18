import { useEffect, useState } from "react";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Spinner, Button, SuccessBanner } from "../components/ui";
import ManualPaymentStatus from "../components/ManualPaymentStatus";
import OrderStatus from "../components/OrderStatus";
import Icon from "../components/Icon";

const STATUS_LABEL = {
  pending_payment: "pending payment",
  confirmed: "paid",
  ready: "ready for pickup",
  completed: "completed",
  cancellation_requested: "cancellation requested",
  cancelled: "cancelled",
};

const STATUS_TONE = {
  pending_payment: "warn",
  confirmed: "accent",
  ready: "info",
  completed: "ok",
  cancellation_requested: "warn",
  cancelled: "danger",
};

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    const { data } = await client.get("/orders");
    setOrders(data.orders);
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmReceipt(o) {
    setError("");
    setSuccess("");
    try {
      await client.post(`/orders/${o.id}/confirm-receipt`, {});
      setSuccess(`Receipt confirmed for order #${o.id.slice(0, 8)}. Order marked as completed!`);
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not confirm receipt of this order"));
    }
  }

  async function cancel(o) {
    setError("");
    setSuccess("");
    try {
      // An unpaid manual payment is cancelled through the payment so the seller's list updates too.
      if (o.payment_provider === "manual" && o.payment_status === "pending") {
        await client.post(`/payments/${o.payment_id}/cancel`, {});
      } else {
        await client.post(`/orders/${o.id}/cancel`, { reason: "Changed my mind" });
      }
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not cancel the order"));
    }
  }

  if (!orders) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="My Orders" subtitle="Track every marketplace purchase from payment to pickup." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      {orders.length === 0 ? (
        <EmptyState
          icon="orders"
          title="No orders yet"
          subtitle="Browse the marketplace to make your first purchase."
          action={<Button as="a" href="/marketplace" variant="outline">Explore marketplace</Button>}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id} className="overflow-hidden p-5 border border-white/90 bg-white/80 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      Order #{o.id.slice(0, 8)}
                    </h3>
                    <Badge tone={STATUS_TONE[o.status] || "slate"}>
                      {STATUS_LABEL[o.status] || o.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="store" className="h-3.5 w-3.5 text-slate-400" /> {o.store_name}
                    </span>
                    <span>·</span>
                    <span>{new Date(o.created_at).toLocaleString()}</span>
                    <span>·</span>
                    <span className="font-bold text-slate-900">{Number(o.total_amount).toFixed(2)} ETB</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {["confirmed", "ready"].includes(o.status) && !o.buyer_confirmed_at && (
                    <Button variant="accent" onClick={() => confirmReceipt(o)}>Confirm receipt</Button>
                  )}
                  {["pending_payment", "confirmed"].includes(o.status) && o.payment_status !== "under_review" && (
                    <Button variant="outline" onClick={() => cancel(o)}>Cancel</Button>
                  )}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200/80 pt-5">
                <OrderStatus status={o.status} />
              </div>

              {(o.merchant_confirmed_at || o.buyer_confirmed_at) && (
                <div className="mt-4 flex flex-wrap gap-4 rounded-xl glass-soft px-3 py-2 text-xs text-muted">
                  {o.merchant_confirmed_at && (
                    <span className="flex items-center gap-1.5">
                      <Icon name="check" className="h-3.5 w-3.5 text-ink" />
                      Payment confirmed by merchant ({new Date(o.merchant_confirmed_at).toLocaleDateString()})
                    </span>
                  )}
                  {o.buyer_confirmed_at && (
                    <span className="flex items-center gap-1.5 text-ok">
                      <Icon name="check" className="h-3.5 w-3.5" />
                      Material delivery confirmed ({new Date(o.buyer_confirmed_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
              )}

              {o.status === "pending_payment" && (
                <div className="mt-4">
                  <ManualPaymentStatus
                    paymentId={o.payment_id}
                    status={o.payment_status}
                    provider={o.payment_provider}
                    rejectReason={o.payment_reject_reason}
                    returnTo="/orders"
                    label={`Order #${o.id.slice(0, 8)} · ${o.store_name}`}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
