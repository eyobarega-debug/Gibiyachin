import { useState, useMemo } from "react";
import Icon from "../Icon";

function formatConversationTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      // Filter by type
      if (activeTab !== "all" && c.type !== activeTab) {
        return false;
      }
      // Filter by search
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const name = c.participant?.name?.toLowerCase() || "";
        const preview = c.lastMessagePreview?.toLowerCase() || "";
        return name.includes(query) || preview.includes(query);
      }
      return true;
    });
  }, [conversations, activeTab, search]);

  const tabs = [
    { key: "all", label: "All" },
    { key: "marketplace", label: "Market" },
    { key: "rental", label: "Rentals" },
    { key: "lost_found", label: "Lost & Found" },
    { key: "dating", label: "Connect ❤️" },
  ];

  return (
    <div className="flex h-full flex-col border-r border-slate-200/80 bg-white">
      {/* Header & Search */}
      <div className="border-b border-slate-200/70 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Icon name="messages" className="h-5 w-5 text-slate-700" />
            Messages
          </h2>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Icon name="close" className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                activeTab === t.key
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <p className="mt-2 font-medium">Loading conversations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <Icon name="messages" className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No conversations found</p>
            <p className="mt-1 text-slate-400">
              {search
                ? "Try adjusting your search terms"
                : "Start a conversation from Marketplace, Rentals, or Lost & Found"}
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const isSelected = c.id === activeId;
            const p = c.participant;
            const isOnline = p?.isOnline;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-start gap-3 p-3.5 text-left transition ${
                  isSelected
                    ? "bg-slate-100/90 border-r-2 border-slate-900"
                    : "hover:bg-slate-50/80"
                }`}
              >
                {/* Avatar with Online Badge */}
                <div className="relative shrink-0">
                  {p?.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white shadow-xs">
                      {p?.name ? p.name[0].toUpperCase() : "U"}
                    </div>
                  )}

                  {isOnline && (
                    <span
                      title="Online"
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400/50"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {p?.name || "Campus Student"}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400 font-medium">
                      {formatConversationTime(c.lastMessageAt || c.createdAt)}
                    </span>
                  </div>

                  {/* Context Badge */}
                  {c.type !== "general" && (
                    <span
                      className={`inline-block mb-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
                        c.type === "dating"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : c.type === "lost_found"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : c.type === "rental"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {c.type === "dating" ? "Connect ❤️" : c.type}
                    </span>
                  )}

                  <p
                    className={`truncate text-xs ${
                      c.unreadCount > 0
                        ? "font-semibold text-slate-900"
                        : "text-slate-500"
                    }`}
                  >
                    {c.lastMessagePreview || "No messages yet"}
                  </p>
                </div>

                {/* Right Badges */}
                <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                  {c.isPinned && (
                    <span className="text-slate-400 text-xs" title="Pinned">
                      📌
                    </span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white shadow-xs">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
