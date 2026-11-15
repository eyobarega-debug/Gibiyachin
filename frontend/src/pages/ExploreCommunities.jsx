import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import Icon from "../components/Icon";
import { Button } from "../components/ui";
import CommunityCard from "../components/communities/CommunityCard";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "academic", label: "Academic" },
  { value: "tech", label: "Tech & Coding" },
  { value: "sports", label: "Sports & Fitness" },
  { value: "creative", label: "Arts & Creative" },
  { value: "campus_life", label: "Campus Life" },
  { value: "gaming", label: "Gaming" },
  { value: "career", label: "Career & Networking" },
];

export default function ExploreCommunities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // all, public, private, official

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (typeFilter) params.type = typeFilter;

      const { data } = await client.get("/communities", { params });
      setCommunities(data.communities || []);
    } catch (err) {
      console.error("Failed to load communities:", err);
    } finally {
      setLoading(false);
    }
  }, [search, category, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommunities();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCommunities]);

  function handleCommunityUpdate(updated) {
    setCommunities((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Campus Communities
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Discover student clubs, study groups, sports teams, and university societies.
          </p>
        </div>

        <Link
          to="/community/create-community"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
        >
          <Icon name="plus" className="h-4 w-4" />
          <span>Create Community</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search communities by name or keyword..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {/* Type select */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="">All Types</option>
          <option value="public">Public</option>
          <option value="private">Private (Invite/Request)</option>
          <option value="official">Official Campus</option>
        </select>
      </div>

      {/* Category Pills */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              category === cat.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Communities Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 border border-slate-200/80 bg-white/60 animate-pulse h-48"
              />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-slate-200 bg-white/80">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
              <Icon name="community" className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No communities found</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              We couldn't find any communities matching your search or filters. Try adjusting your criteria or create a new community!
            </p>
            <Link
              to="/community/create-community"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <Icon name="plus" className="h-4 w-4" />
              Start a Community
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((comm) => (
              <CommunityCard
                key={comm.id}
                community={comm}
                onJoinStatusChange={handleCommunityUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
