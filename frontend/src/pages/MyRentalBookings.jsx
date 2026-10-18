import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { useAuth, errMsg } from "../context/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, TextArea } from "../components/ui";
import Icon from "../components/Icon";

const STATUS_TONE = {
  pending_payment: "warn",
  confirmed_awaiting_pickup: "accent",
  active: "ok",
  overdue: "danger",
  completed: "slate",
  cancelled: "danger",
  disputed: "warn",
};

export default function MyRentalBookings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetBookingId = searchParams.get("bookingId");
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const [notFoundNotice, setNotFoundNotice] = useState("");
  const [disputeFor, setDisputeFor] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");

  async function load() {
    const { data } = await client.get("/rentals/bookings/mine");
    setBookings(data.bookings);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!bookings || !targetBookingId) return;
    const found = bookings.some((b) => b.id === targetBookingId);
    if (found) {
      setTimeout(() => {
        const el = document.getElementById(`booking-${targetBookingId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    } else {
      setNotFoundNotice(`Rental booking #${targetBookingId.slice(0, 8)} could not be found or has been removed.`);
    }
  }, [bookings, targetBookingId]);

  async function act(path, id, body) {
    setError("");
    try {
      await client.post(`/rentals/bookings/${id}/${path}`, body || {});
      await load();
    } catch (err) {
      setError(errMsg(err, "Action failed"));
    }
  }

  async function submitDispute(id) {
    await act("dispute", id, { reason: disputeReason });
    setDisputeFor(null);
    setDisputeReason("");
  }

  if (!bookings) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="My Rental Bookings" subtitle="As borrower and as lender — pickup, return, and disputes happen here." />
      <ErrorBanner message={error} />
      {notFoundNotice && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300/60 bg-amber-50/90 p-4 text-sm text-amber-800 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Icon name="alertCircle" className="h-5 w-5 shrink-0 text-amber-600" />
            <span>{notFoundNotice}</span>
          </div>
          <button
            onClick={() => setNotFoundNotice("")}
            className="text-xs font-semibold uppercase tracking-wider text-amber-700 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const iAmBorrower = user.id !== b.owner_id;
            const isSelected = targetBookingId && b.id === targetBookingId;
            return (
              <Card
                key={b.id}
                id={`booking-${b.id}`}
                className={`glass glass-hover p-5 transition-all duration-300 ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-lg bg-white/95"
                    : ""
                }`}
              >
                {isSelected && (
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
                    <span className="flex items-center gap-1.5">
                      <Icon name="checkCircle" className="h-4 w-4" />
                      Selected booking from notification
                    </span>
                    <Badge tone="accent" className="animate-pulse">Active</Badge>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {b.title} <span className="text-xs text-muted">({iAmBorrower ? "borrowing" : "lending"})</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
                      <span>{b.start_date?.slice(0, 10)}</span>
                      <Icon name="arrowRight" className="h-3 w-3" />
                      <span>{b.end_date?.slice(0, 10)}</span>
                      <span>· deposit status: {b.deposit_status}</span>
                      {Number(b.late_fee) > 0 && <span>· late fee {Number(b.late_fee).toFixed(2)} ETB</span>}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status] || "slate"}>{b.status.replaceAll("_", " ")}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {iAmBorrower && b.status === "confirmed_awaiting_pickup" && (
                    <Button variant="accent" onClick={() => act("pickup", b.id)}>Confirm item receipt / pickup</Button>
                  )}
                  {!iAmBorrower && b.status === "confirmed_awaiting_pickup" && (
                    <span className="text-xs text-muted self-center italic">Waiting for renter to confirm physical pickup</span>
                  )}
                  {!iAmBorrower && ["active", "overdue"].includes(b.status) && (
                    <Button variant="accent" onClick={() => act("return", b.id, { condition: "good" })}>
                      Confirm return
                    </Button>
                  )}
                  {["active", "overdue", "confirmed_awaiting_pickup"].includes(b.status) && (
                    <Button variant="outline" onClick={() => setDisputeFor(b.id)}>Report a problem</Button>
                  )}
                </div>

                {(b.owner_confirmed_at || b.renter_confirmed_at) && (
                  <div className="mt-2 flex flex-wrap gap-4 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs text-muted shadow-xs">
                    {b.owner_confirmed_at && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="check" className="h-3.5 w-3.5 text-emerald-500" />
                        Payment confirmed by owner ({new Date(b.owner_confirmed_at).toLocaleDateString()})
                      </span>
                    )}
                    {b.renter_confirmed_at && (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <Icon name="check" className="h-3.5 w-3.5" />
                        Item pickup confirmed by renter ({new Date(b.renter_confirmed_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                )}

                {disputeFor === b.id && (
                  <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                    <TextArea
                      label="What went wrong?"
                      rows={2}
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => submitDispute(b.id)}>Submit dispute</Button>
                      <Button variant="ghost" onClick={() => setDisputeFor(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
