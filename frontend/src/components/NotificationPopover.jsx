import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { client } from "../api/client";
import Icon from "./Icon";
import {
  handleNotificationClick,
  resolveNotificationTarget,
} from "../utils/notificationNavigation";

export default function NotificationPopover({ unreadCount = 0, onUnreadChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);
  const popoverRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load preview notifications when dropdown is opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function fetchNotifications() {
      setLoading(true);
      try {
        const { data } = await client.get("/notifications");
        if (!cancelled) {
          setItems(data.notifications || []);
          if (typeof onUnreadChange === "function" && typeof data.unreadCount === "number") {
            onUnreadChange(data.unreadCount);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNotifications();

    return () => {
      cancelled = true;
    };
  }, [open, onUnreadChange]);

  // Click outside and escape key handling
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Close popover upon route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function handleItemClick(n) {
    setOpen(false);

    // Optimistically mark as read in local state
    setItems((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item))
    );

    if (typeof onUnreadChange === "function" && !n.read_at && unreadCount > 0) {
      onUnreadChange(Math.max(0, unreadCount - 1));
    }

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

  async function markAllRead(e) {
    e.stopPropagation();
    setMarkingAll(true);
    try {
      await client.post("/notifications/read-all");
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      if (typeof onUnreadChange === "function") {
        onUnreadChange(0);
      }
    } catch {
      // Ignored
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadItemsCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/80 text-slate-700 shadow-xs transition hover:bg-white hover:text-slate-900 focus:outline-hidden"
        aria-label="Toggle notifications dropdown"
        aria-expanded={open}
      >
        <Icon name="bell" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#1c222c] px-1 text-[10px] font-bold text-white ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unreadItemsCount > 0 && (
                <span className="rounded-full bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {unreadItemsCount} new
                </span>
              )}
            </div>
            {unreadItemsCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll}
                className="text-xs text-slate-500 hover:text-slate-900 transition font-medium disabled:opacity-50"
              >
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/80 py-1 thin-scrollbar">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center px-4">
                <Icon name="bell" className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Updates on your orders, tickets, and bookings will appear here.
                </p>
              </div>
            ) : (
              items.slice(0, 7).map((n) => {
                const targetUrl = resolveNotificationTarget(n);
                const isUnread = !n.read_at;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition ${
                      isUnread
                        ? "bg-slate-50/90 hover:bg-slate-100/90"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0">
                      {isUnread ? (
                        <span className="block h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs truncate ${
                          isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                          {n.body}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {targetUrl && targetUrl !== "/notifications" && (
                          <span className="text-slate-600 group-hover:text-slate-900 font-medium flex items-center gap-0.5">
                            View <Icon name="arrowRight" className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200/80 text-center">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

