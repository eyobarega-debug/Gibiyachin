import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { useAuth, errMsg } from "../context/AuthContext";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorBanner, Input, PageHeader, Spinner, SuccessBanner, Tabs } from "../components/ui";
import ProofImage from "../components/ProofImage";
import Icon from "../components/Icon";
import { useConfirm } from "../components/ConfirmProvider";

const TABS = [
  { id: "review", label: "To review", url: "/payments/manual/incoming?status=under_review" },
  { id: "awaiting", label: "Waiting for payment", url: "/payments/manual/incoming?status=pending" },
  { id: "history", label: "History", url: "/payments/manual/incoming?status=all", filter: (p) => ["confirmed", "failed", "refunded"].includes(p.status) },
  { id: "mine", label: "My payments", url: "/payments/manual/mine?status=all" },
];

const STATUS_TONE = { pending: "warn", under_review: "accent", confirmed: "ok", failed: "danger", refunded: "slate" };
const STATUS_TEXT = { pending: "waiting for proof", under_review: "to review", confirmed: "approved", failed: "cancelled", refunded: "refunded" };

function ReviewRow({ p, user, onDone, setError, defaultShowImg = false }) {
  const [showImg, setShowImg] = useState(defaultShowImg);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelPayment, setCancelPayment] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const isAdmin = ["admin", "super_admin"].includes(user?.role);
  const isTicket = p.transactionType === "ticket";

  async function act(path, body) {
    setError("");
    setBusy(true);
    try {
      await client.post(`/payments/${p.id}/${path}`, body || {});
      onDone(path === "approve" ? "Payment approved. The buyer has been notified." : "Payment rejected. The buyer has been notified.");
    } catch (err) {
      setError(errMsg(err, "Could not update this payment"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    const ok = await confirm({
      title: "Approve payment?",
      message: `Confirm you received ${p.amount.toFixed(2)} ETB from ${p.payerName}?`,
      confirmLabel: "Approve payment",
      variant: "primary",
    });
    if (ok) await act("approve");
  }

  if (isTicket && !isAdmin) {
    return (
      <div className="mt-3 border-t border-slate-200/80 pt-3">
        <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5 text-xs text-ink space-y-1.5 shadow-xs">
          <p className="font-semibold text-ink">Event Ticket Payment — ግቢያችን Admin Approval Required</p>
          <p className="text-muted">
            Event ticket payments are received directly by ግቢያችን's designated admin account.
            Only authorized administrators can verify and approve ticket payments. Once verified, the attendee receives their active ticket and QR code, and 97.5% net revenue is allocated to your organizer payout balance.
          </p>
          <p className="font-mono text-muted">Reference: {p.proof?.referenceNumber || "None submitted"}</p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={() => setShowImg((v) => !v)}>{showImg ? "Hide screenshot" : "View screenshot"}</Button>
        </div>
        {showImg && <div className="mt-3"><ProofImage paymentId={p.id} /></div>}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
     <p className="text-sm text-muted">
        Reference <span className="font-mono text-ink">{p.proof?.referenceNumber}</span>. Check that{" "}
        <strong className="text-ink">{p.amount.toFixed(2)} ETB</strong> actually arrived in your account before approving.
        {isTicket && (
          <span className="block text-xs text-ink font-medium mt-0.5">
            Admin verification: Approving issues the ticket QR code, retains 2.5% platform commission, and attributes 97.5% net payable to the event organizer.
          </span>
        )}
        {!isTicket && p.commissionRate != null && p.commissionRate > 0 && (
          <span className="block text-xs mt-0.5 text-muted">
            Approving adds a {Math.round(p.commissionRate * 100)}% platform commission to your account
            {p.transactionType === "booking" ? " (on the rental fee, deposit excluded)" : ""}.
          </span>
        )}
        {!isTicket && p.commissionRate === 0 && (
          <span className="block text-xs text-ok mt-0.5">
            0% commission — 100% of the rental fee belongs to the lender.
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setShowImg((v) => !v)}>{showImg ? "Hide screenshot" : "View screenshot"}</Button>
        <Button variant="accent" loading={busy} disabled={busy} onClick={approve}>
          Approve
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setRejecting((v) => !v)}>Reject</Button>
      </div>
      {showImg && <div className="mt-3"><ProofImage paymentId={p.id} /></div>}
      {rejecting && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-xs">
          <Input
            label="Rejection reason"
            required
            placeholder="e.g. amount doesn't match"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Checkbox
            label="Cancel the whole purchase (otherwise the buyer can upload a corrected proof)"
            checked={cancelPayment}
            onChange={(e) => setCancelPayment(e.target.checked)}
          />
          <Button variant="danger" loading={busy} disabled={busy || reason.trim().length < 3} onClick={() => act("reject", { reason: reason.trim(), cancelPayment })}>
            Send rejection
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PaymentApprovals() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetPaymentId = searchParams.get("paymentId");
  const [tab, setTab] = useState(user?.role === "student" ? "mine" : "review");
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsAccount, setNeedsAccount] = useState(false);
  const [notFoundNotice, setNotFoundNotice] = useState("");

  const current = TABS.find((t) => t.id === tab);

  // Auto-switch tab based on targetPaymentId status
  useEffect(() => {
    if (!targetPaymentId) return;
    client.get(`/payments/${targetPaymentId}`).then(({ data }) => {
      const p = data.payment;
      if (!p) return;
      if (user?.role === "student" || p.payer_id === user?.id) {
        setTab("mine");
      } else if (p.status === "under_review") {
        setTab("review");
      } else if (p.status === "pending") {
        setTab("awaiting");
      } else {
        setTab("history");
      }
    }).catch(() => {
      setNotFoundNotice(`Payment #${targetPaymentId.slice(0, 8)} could not be found or has expired.`);
    });
  }, [targetPaymentId, user]);

  const load = useCallback(async () => {
    try {
      const { data } = await client.get(current.url);
      setItems(current.filter ? data.payments.filter(current.filter) : data.payments);
    } catch (err) {
      setError(errMsg(err, "Could not load payments"));
    }
  }, [current]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  useEffect(() => {
    client.get("/payments/manual/incoming?status=under_review").then(({ data }) => setCounts({ review: data.payments.length })).catch(() => {});
    if (user && ["merchant", "organizer"].includes(user.role)) {
      client.get("/payout-accounts").then(({ data }) => setNeedsAccount(data.accounts.length === 0)).catch(() => {});
    }
  }, [user, success]);

  // Scroll to target payment card when loaded
  useEffect(() => {
    if (!items || !targetPaymentId) return;
    const found = items.some((p) => p.id === targetPaymentId);
    if (found) {
      setTimeout(() => {
        const el = document.getElementById(`payment-${targetPaymentId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  }, [items, targetPaymentId]);

  function done(msg) {
    setSuccess(msg);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Students pay your account directly and upload a screenshot. You confirm it here."
        action={<Button as={Link} to="/payout-accounts" variant="outline">Payout accounts</Button>}
      />
      {needsAccount && (
        <div className="mb-4 rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">
          You haven't added a payout account yet, so students can't pay you directly.{" "}
          <Link to="/payout-accounts" className="font-medium underline">Add one</Link>
        </div>
      )}
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      {notFoundNotice && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-xs text-amber-800 shadow-xs">
          <div className="flex items-center gap-2">
            <Icon name="info" className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{notFoundNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotFoundNotice("")}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2 text-sm leading-none"
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      <Tabs
        className="my-4"
        value={tab}
        onChange={(key) => {
          setTab(key);
          setSuccess("");
          setError("");
        }}
        items={TABS.map((t) => ({
          key: t.id,
          label: t.label,
          count: t.id === "review" && counts.review ? counts.review : undefined,
        }))}
      />

      {!items ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" subtitle={tab === "review" ? "No payment proofs are waiting for you." : "No payments in this list."} />
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const isTarget = targetPaymentId === p.id;
            return (
              <Card
                key={p.id}
                id={`payment-${p.id}`}
                className={`p-4 transition-all duration-300 border ${
                  isTarget
                    ? "border-blue-500/90 bg-white shadow-xl ring-2 ring-blue-500/30 scale-[1.01]"
                    : "border-white/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink">{p.description || `${p.transactionType} payment`}</p>
                      {isTarget && <Badge tone="accent">Selected from notification</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {tab === "mine" ? `To ${p.payeeName}` : `From ${p.payerName}`} · {new Date(p.createdAt).toLocaleString()}
                    </p>
                    {p.proof?.status === "rejected" && p.status !== "under_review" && (
                      <p className="mt-1 text-xs text-danger">Rejected: {p.proof.rejectReason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink">{p.amount.toFixed(2)} <span className="text-xs font-medium text-muted">ETB</span></p>
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status] || p.status}</Badge>
                  </div>
                </div>
                {tab === "mine" && ["pending", "under_review"].includes(p.status) && (
                  <div className="mt-3">
                    <Button as={Link} to={`/pay/manual/${p.id}`} variant="outline">
                      {p.status === "pending" ? "Upload proof" : "View status"}
                    </Button>
                  </div>
                )}
                {tab !== "mine" && p.status === "under_review" && (
                  <ReviewRow p={p} user={user} onDone={done} setError={setError} defaultShowImg={isTarget} />
                )}
                {tab !== "mine" && p.status === "confirmed" && p.proof && (
                  <p className="mt-2 text-xs text-muted">Reference <span className="font-mono text-ink">{p.proof.referenceNumber}</span></p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}