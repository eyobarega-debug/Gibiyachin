import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { client } from "../api/client";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, Tabs } from "../components/ui";
import Icon from "../components/Icon";
import {
  handleNotificationClick,
  resolveNotificationTarget,
} from "../utils/notificationNavigation";

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const navigate = useNavigate();
  const location = useLocation();

  async function load() {
    const { data } = await client.get("/notifications");
    setItems(data.notifications || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(e, id) {
    e.stopPropagation();
    try {
      await client.patch(`/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
      );
    } catch {
      // Ignored
    }
  }

  async function markAllRead() {
    try {
      await client.post("/notifications/read-all");
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch {
      // Ignored
    }
  }

  async function onCardClick(n) {
    setItems((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item))
    );

    await handleNotificationClick(n, {
      navigate,
      currentPath: location.pathname + location.search,
      onMarkRead: (id) => {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item))
        );
      },
    });
  }

  if (!items) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read_at).length;
  const filtered = filter === "unread" ? items.filter((n) => !n.read_at) : items;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on your orders, payments, tickets, and rentals. Tap any notification to go directly to its details."
        action={
          unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              Mark all read ({unreadCount})
            </Button>
          )
        }
      />

      {items.length > 0 && (
        <Tabs
          className="mb-4"
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: "All Updates", count: items.length },
            { key: "unread", label: "Unread", count: unreadCount },
          ]}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="bell"
          title={filter === "unread" ? "No unread notifications" : "Nothing yet"}
          subtitle={
            filter === "unread"
              ? "You are all caught up! Switch to 'All Updates' to view past history."
              : "Activity and transaction updates across ግቢያችን will appear here."
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => {
            const isUnread = !n.read_at;
            const targetUrl = resolveNotificationTarget(n);
            const hasTarget = targetUrl && targetUrl !== "/notifications";

            return (
              <Card
                key={n.id}
                onClick={() => onCardClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardClick(n);
                  }
                }}
                className={`group relative p-4 transition-all duration-200 cursor-pointer border ${
                  isUnread
                    ? "bg-white/95 border-slate-300 shadow-md ring-1 ring-slate-900/5 hover:border-slate-400"
                    : "bg-white/70 border-white/80 hover:bg-white/90 shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Visual indicator dot */}
                    <div className="mt-1 shrink-0">
                      {isUnread ? (
                        <span className="block h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-slate-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-sm tracking-tight ${
                            isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                          }`}
                        >
                          {n.title}
                        </p>
                        {isUnread && <Badge tone="accent">new</Badge>}
                      </div>

                      {n.body && (
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {n.body}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{new Date(n.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {hasTarget && (
                          <span className="text-slate-600 group-hover:text-slate-900 font-medium inline-flex items-center gap-1 transition">
                            View details
                            <Icon name="arrowRight" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => markRead(e, n.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="Mark as read without opening"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
