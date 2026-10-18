import { useEffect, useMemo, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, PageHeader, Select, Table } from "../../components/ui";
import { ORDER_STATUS_FILTERS, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, fmtDate, fmtMoney, humanize, shortId } from "./constants";
import OrderDetailModal from "./OrderDetailModal";

export default function SuperAdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [campusNames, setCampusNames] = useState({});
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    client
      .get("/super/universities")
      .then(({ data }) => {
        const map = {};
        for (const u of data.universities || []) map[u.id] = u.name;
        setCampusNames(map);
      })
      .catch(() => setCampusNames({}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setOrders(null);
    const params = { page };
    if (status) params.status = status;
    client
      .get("/orders", { params })
      .then(({ data }) => !cancelled && setOrders(data.orders || []))
      .catch((err) => {
        if (cancelled) return;
        setError(errMsg(err, "Could not load orders"));
        setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status, page]);

  const hasNext = useMemo(() => (orders?.length || 0) >= 20, [orders]);

  return (
    <div>
      <PageHeader
        title="Orders & Payments"
        subtitle="Platform-wide order visibility. Payment settlement stays with the backend/provider."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="mb-4 grid gap-3 sm:max-w-xs">
        <Select
          aria-label="Filter by order status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {ORDER_STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {orders === null ? (
        <LoadingState label="Loading orders…" />
      ) : orders.length === 0 ? (
        <EmptyState icon="orders" title="No orders found" subtitle="Try a different status filter." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table head={["Order", "Buyer", "Store / Merchant", "Campus", "Amount", "Status", "Payment", "Date", ""]}>
              {orders.map((o) => (
                <tr key={o.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-ink">#{shortId(o.id)}</td>
                  <td className="px-4 py-3">{o.buyer_name}</td>
                  <td className="px-4 py-3">
                    {o.store_name}
                    <span className="block text-xs text-muted">{o.merchant_name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{campusNames[o.university_id] || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{fmtMoney(o.total_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ORDER_STATUS_TONE[o.status] || "slate"}>{ORDER_STATUS_LABEL[o.status] || humanize(o.status)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {o.payment_status ? (
                      <Badge tone={PAYMENT_STATUS_TONE[o.payment_status] || "slate"}>{humanize(o.payment_status)}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(o.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {orders.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">#{shortId(o.id)}</p>
                    <p className="truncate text-xs text-muted">
                      {o.store_name} · {o.buyer_name}
                    </p>
                  </div>
                  <Badge tone={ORDER_STATUS_TONE[o.status] || "slate"}>{ORDER_STATUS_LABEL[o.status] || humanize(o.status)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-semibold text-ink">{fmtMoney(o.total_amount)}</span>
                  <span>{fmtDate(o.created_at)}</span>
                  {o.payment_status && <Badge tone={PAYMENT_STATUS_TONE[o.payment_status] || "slate"}>{humanize(o.payment_status)}</Badge>}
                </div>
                <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => setDetailId(o.id)}>
                  View order
                </Button>
              </Card>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted">Page {page}</span>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}

      <OrderDetailModal open={!!detailId} orderId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
