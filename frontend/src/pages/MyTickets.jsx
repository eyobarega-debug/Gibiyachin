import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, SuccessBanner, Tabs } from "../components/ui";
import TicketCard from "../components/TicketCard";
import Icon from "../components/Icon";
import { useConfirm } from "../components/ConfirmProvider";

export default function MyTickets() {
  const [searchParams] = useSearchParams();
  const targetTicketId = searchParams.get("ticketId");
  const [tickets, setTickets] = useState(null);
  const [waitlist, setWaitlist] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notFoundNotice, setNotFoundNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const confirm = useConfirm();

  async function load() {
    try {
      const [ticketsRes, waitlistRes] = await Promise.all([
        client.get("/tickets/mine"),
        client.get("/events/waitlist/mine"),
      ]);
      setTickets(ticketsRes.data.tickets || []);
      setWaitlist(waitlistRes.data.entries || []);
    } catch (err) {
      setError(errMsg(err, "Could not load tickets"));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!tickets || !targetTicketId) return;
    const found = tickets.find((t) => t.id === targetTicketId);
    if (found) {
      setFilter("all");
      setTimeout(() => {
        const el = document.getElementById(`ticket-${targetTicketId}`) || document.getElementById(`ticket-pass-${targetTicketId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    } else {
      setNotFoundNotice(`Ticket #${targetTicketId.slice(0, 8)} could not be found or has been removed.`);
    }
  }, [tickets, targetTicketId]);

  async function cancelActiveTicket(ticketId) {
    const ok = await confirm({
      title: "Cancel ticket?",
      message: "Are you sure you want to cancel this ticket? If you paid, a refund will be processed.",
      confirmLabel: "Cancel ticket",
      variant: "danger",
    });
    if (!ok) return;
    setError("");
    setSuccess("");
    try {
      await client.post(`/tickets/${ticketId}/cancel`, { reason: "Attendee cancellation" });
      setSuccess("Ticket cancelled successfully.");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not cancel the ticket"));
    }
  }

  async function cancelUnpaidReservation(t) {
    const ok = await confirm({
      title: "Cancel reservation?",
      message: "Cancel this unpaid ticket reservation? Your seat will be released back to the event.",
      confirmLabel: "Cancel reservation",
      variant: "danger",
    });
    if (!ok) return;
    setError("");
    setSuccess("");
    try {
      await client.post(`/payments/${t.payment_id}/cancel`, {});
      setSuccess("Reservation cancelled.");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not cancel the reservation"));
    }
  }

  if (!tickets) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const filteredTickets = tickets.filter((t) => {
    if (filter === "all") return true;
    if (filter === "active") return t.status === "active";
    if (filter === "reserved") return t.status === "reserved";
    if (filter === "used") return t.status === "used";
    if (filter === "cancelled") return t.status === "cancelled" || t.status === "expired";
    return true;
  });

  return (
    <div>
      <PageHeader
        title="My Event Tickets"
        subtitle="Your personalized passes with cryptographically signed QR codes. Present at the event entrance for admission."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

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

      {/* Filter Tabs */}
      {tickets.length > 0 && (
        <Tabs
          className="no-print mb-6"
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: "All", count: tickets.length },
            { key: "active", label: "Valid & Ready", count: tickets.filter((t) => t.status === "active").length },
            { key: "reserved", label: "Pending Payment", count: tickets.filter((t) => t.status === "reserved").length },
            { key: "used", label: "Used", count: tickets.filter((t) => t.status === "used").length },
            {
              key: "cancelled",
              label: "Cancelled",
              count: tickets.filter((t) => t.status === "cancelled" || t.status === "expired").length,
            },
          ]}
        />
      )}

      {tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          subtitle="Explore upcoming campus events and reserve your passes."
          action={
            <Button as={Link} to="/events" variant="accent" className="mt-3">
              Browse Events
            </Button>
          }
        />
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title="No tickets in this category"
          subtitle="Switch filters to view your other event passes."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredTickets.map((t) => {
            const isSelected = targetTicketId && t.id === targetTicketId;
            return (
              <div
                key={t.id}
                id={`ticket-${t.id}`}
                className={`relative transition-all duration-300 rounded-[26px] ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-4 ring-offset-bg shadow-xl"
                    : ""
                }`}
              >
                {isSelected && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
                    <span className="flex items-center gap-1.5">
                      <Icon name="checkCircle" className="h-4 w-4" />
                      Selected ticket from notification
                    </span>
                    <Badge tone="accent" className="animate-pulse">Active</Badge>
                  </div>
                )}
                <TicketCard
                  ticket={t}
                  onCancel={cancelActiveTicket}
                  onCancelUnpaid={cancelUnpaidReservation}
                />
              </div>
            );
          })}
        </div>
      )}

      {waitlist && waitlist.length > 0 && (
        <div className="no-print mt-10">
          <h2 className="mb-3 font-semibold text-ink">My Waitlist Status</h2>
          <div className="space-y-2">
            {waitlist.map((w) => (
              <Card key={w.id} className="glass glass-hover flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-ink">{w.event_title}</p>
                  <p className="text-xs text-muted">
                    {w.ticket_type} · {new Date(w.date_time).toLocaleString()}
                  </p>
                </div>
                <Badge tone={w.status === "notified" ? "accent" : "slate"}>
                  {w.status === "notified" ? "Spot available!" : "Waiting in queue"}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
