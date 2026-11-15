import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { client } from "../../api/client";
import Icon from "../Icon";

export default function TrendingSidebar({ onSelectTag, activeTag }) {
  const [trending, setTrending] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSidebarData() {
      try {
        const [trendRes, commRes, annRes] = await Promise.allSettled([
          client.get("/social/trending"),
          client.get("/communities?limit=4"),
          client.get("/announcements?limit=2"),
        ]);

        if (isMounted) {
          if (trendRes.status === "fulfilled") {
            setTrending(trendRes.value.data.trendingTags || []);
          }
          if (commRes.status === "fulfilled") {
            setSuggestedCommunities(commRes.value.data.communities || []);
          }
          if (annRes.status === "fulfilled") {
            setAnnouncements(annRes.value.data.announcements || []);
          }
        }
      } catch {
        // silent fail for sidebar
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSidebarData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <aside className="space-y-4">
      {/* Official Campus Announcements */}
      {announcements.length > 0 && (
        <div className="glass rounded-2xl p-4 border border-blue-200/60 bg-blue-50/50">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-200/50">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-800">
              <Icon name="announcement" className="h-4 w-4 text-blue-600" />
              <span>Campus Notices</span>
            </div>
            <Link
              to="/community/announcements"
              className="text-[11px] font-semibold text-blue-700 hover:underline"
            >
              View All
            </Link>
          </div>

          <div className="space-y-2.5">
            {announcements.map((ann) => (
              <div key={ann.id} className="text-xs">
                <div className="flex items-center gap-1 font-semibold text-slate-900">
                  {ann.isPinned && <span className="text-amber-600 font-bold">📌</span>}
                  <span className="line-clamp-1">{ann.content.slice(0, 70)}...</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(ann.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Campus Topics */}
      <div className="glass rounded-2xl p-4 border border-slate-200/80 bg-white/80">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
            <Icon name="poll" className="h-4 w-4 text-slate-600" />
            <span>Trending Topics</span>
          </div>
          {activeTag && (
            <button
              type="button"
              onClick={() => onSelectTag && onSelectTag(null)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-xs text-slate-400 py-2">Loading trends...</div>
        ) : trending.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No trending topics yet. Start one by tagging posts with #topic!</div>
        ) : (
          <div className="space-y-2">
            {trending.map((item) => {
              const isSelected = activeTag === item.tag;
              return (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => onSelectTag && onSelectTag(item.tag)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition ${
                    isSelected
                      ? "bg-slate-900 font-bold text-white"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <span className="truncate">#{item.tag}</span>
                  <span
                    className={`ml-2 text-[11px] shrink-0 ${
                      isSelected ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {item.count} {item.count === 1 ? "post" : "posts"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested Campus Communities */}
      <div className="glass rounded-2xl p-4 border border-slate-200/80 bg-white/80">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
            <Icon name="community" className="h-4 w-4 text-slate-600" />
            <span>Communities</span>
          </div>
          <Link
            to="/community/explore"
            className="text-[11px] font-semibold text-slate-700 hover:underline"
          >
            Explore
          </Link>
        </div>

        {suggestedCommunities.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">No communities yet. Be the first to create one!</div>
        ) : (
          <div className="space-y-3">
            {suggestedCommunities.map((comm) => (
              <div key={comm.id} className="flex items-center justify-between gap-2">
                <Link
                  to={`/community/communities/${comm.slug || comm.id}`}
                  className="flex items-center gap-2.5 min-w-0 group"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                    {comm.avatarUrl ? (
                      <img src={comm.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      comm.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-800 truncate group-hover:underline">
                      {comm.name}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {comm.membersCount || 0} members
                    </span>
                  </div>
                </Link>

                <Link
                  to={`/community/communities/${comm.slug || comm.id}`}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
