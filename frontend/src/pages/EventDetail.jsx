import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth, errMsg } from "../context/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, SuccessBanner } from "../components/ui";
import { MediaImage } from "../components/cards";
import Icon from "../components/Icon";
import { PAYMENT_METHOD, startCheckout } from "../api/checkout";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [ticketTypes, setTicketTypes] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [waitlisted, setWaitlisted] = useState({});

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await client.get(`/events/${id}`);
      setEvent(data.event);
      setTicketTypes(data.ticketTypes);
    } catch (err) {
      if (err?.response?.status === 404) {
        setLoadError("This event was not found or is not available at your campus.");
      } else {
        setLoadError(errMsg(err, "Could not load this event."));
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function buy(ticketTypeId) {
    setError("");
    setBusyId(ticketTypeId);
    try {
      const { data } = await client.post(`/events/${id}/tickets`, { ticketTypeId, paymentMethod: PAYMENT_METHOD });
      startCheckout(navigate, data.payment, { returnTo: "/tickets", label: `Ticket: ${event.title}` });
    } catch (err) {
      setError(errMsg(err, "Could not reserve ticket"));
      setBusyId(null);
    }
  }

  async function joinWaitlist(ticketTypeId) {
    setError("");
    setSuccess("");
    try {
      await client.post(`/events/${id}/waitlist`, { ticketTypeId });
      setWaitlisted({ ...waitlisted, [ticketTypeId]: true });
      setSuccess("You're on the waitlist — we'll notify you if a spot opens up.");
    } catch (err) {
      setError(errMsg(err, "Could not join waitlist"));
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (loadError || !event) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <EmptyState
          title="Event Unavailable"
          subtitle={loadError || "This event was not found or is not available at your campus."}
          action={
            <Button as={Link} to="/events" variant="primary" className="mt-4">
              Back to Events
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={event.title}
        subtitle={`${event.organizer_name || event.club_name} · ${new Date(event.date_time).toLocaleString()} · ${event.venue_name || event.location}`}
      />
      <Card className="overflow-hidden border border-white/90 bg-white/80 shadow-md">
        <div className="relative h-64 w-full overflow-hidden bg-slate-100">
          <MediaImage src={event.poster_url} alt={event.title} icon="events" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/40 to-transparent" />
        </div>

        <div className="p-6">
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Organizer:</span>{" "}
              <span className="text-xs font-bold text-slate-900">{event.organizer_name || event.club_name}</span>
              {event.contact_info && <p className="text-xs text-slate-500">Contact: {event.contact_info}</p>}
            </div>
            {event.category && (
              <Badge tone="accent">{event.category}</Badge>
            )}
          </div>

          <div className="mb-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-500">
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Icon name="mapPin" className="h-3.5 w-3.5 text-slate-500" />
              Venue & Location:
            </p>
            <p className="font-medium text-slate-800">{event.venue_name || event.location}</p>
            {event.venue_address && <p>{event.venue_address}</p>}
            {event.end_time && (
              <p className="mt-1 flex items-center gap-1.5">
                <Icon name="clock" className="h-3.5 w-3.5 text-slate-500" />
                Ends at: {new Date(event.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">{event.description}</p>

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold text-slate-900">Available Ticket Tiers</h3>
            {ticketTypes.map((tt) => {
              const soldOut = tt.quantity_sold >= tt.quantity_total;
              return (
                <div key={tt.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{tt.name}</p>
                    {tt.description && <p className="text-xs text-slate-500">{tt.description}</p>}
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {Number(tt.price) > 0 ? `${Number(tt.price).toFixed(2)} ETB` : "FREE ADMISSION"} · {tt.quantity_total - tt.quantity_sold} left
                    </p>
                  </div>
                {soldOut ? (
                  user?.role === "student" ? (
                    waitlisted[tt.id] ? (
                      <Badge tone="ok">On waitlist</Badge>
                    ) : (
                      <Button variant="outline" onClick={() => joinWaitlist(tt.id)}>Join waitlist</Button>
                    )
                  ) : (
                    <Badge tone="danger">Sold out</Badge>
                  )
                ) : user?.role === "student" ? (
                  <Button variant="accent" disabled={busyId === tt.id} onClick={() => buy(tt.id)}>
                    {busyId === tt.id ? "Reserving..." : "Buy ticket"}
                  </Button>
                ) : (
                  <span className="text-xs text-slate-500">Log in as a student to buy</span>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </Card>
    </div>
  );
}
