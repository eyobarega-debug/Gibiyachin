import { useEffect, useState } from "react";
import { client } from "../api/client";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";

export default function Notifications() {
  const [items, setItems] = useState(null);

  async function load() {
    const { data } = await client.get("/notifications");
    setItems(data.notifications);
  }
  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    await client.patch(`/notifications/${id}/read`);
    load();
  }
  async function markAllRead() {
    await client.post("/notifications/read-all");
    load();
  }

  if (!items) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle="Order, rental, event, and ticket updates land here (FR-045)."
        action={items.some((n) => !n.read_at) && <Button variant="outline" onClick={markAllRead}>Mark all read</Button>}
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" subtitle="Activity across ግቢያችን will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={`p-4 glass glass-hover border border-white/80 ${!n.read_at ? "bg-white/95 border-slate-300/90 shadow-sm" : "bg-white/70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read_at && <Badge tone="accent">new</Badge>}
                  {!n.read_at && (
                    <Button variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
