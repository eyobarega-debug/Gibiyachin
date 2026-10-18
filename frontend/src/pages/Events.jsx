import { useEffect, useState } from "react";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, Spinner } from "../components/ui";
import { EventCard } from "../components/cards";
import Icon from "../components/Icon";

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);

  useEffect(() => {
    client.get("/events").then(({ data }) => setEvents(data.events));
  }, []);

  if (!events) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Campus Events</h1>
          <p className="mt-1 text-sm text-muted">
            Approved, published events open for ticket sales.
          </p>
        </div>
        {user?.university_name && (
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink">
            <Icon name="mapPin" className="h-3.5 w-3.5 text-muted" />
            {user.university_name}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState icon="events" title="No published events right now" className="mt-6" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
