import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import LostFoundCard from "../components/LostFoundCard";
import { Tabs, EmptyState, Skeleton, ErrorBanner, Button, Select } from "../components/ui";
import Icon from "../components/Icon";

const CATEGORIES = [
  "All Categories",
  "Student ID Cards",
  "Electronics",
  "Phones",
  "Laptops",
  "Bags and Backpacks",
  "Books and Notes",
  "Wallets",
  "Keys",
  "Clothing",
  "Accessories",
  "Other",
];

const TYPE_TABS = [
  { key: "all", label: "All Items" },
  { key: "lost", label: "Lost Belongings" },
  { key: "found", label: "Found Items" },
];

export default function LostFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const typeParam = searchParams.get("type") || "all";
  const catParam = searchParams.get("category") || "";
  const qParam = searchParams.get("q") || "";
  const statusParam = searchParams.get("status") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  const [inputVal, setInputVal] = useState(qParam);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync search input
  useEffect(() => {
    setInputVal(qParam);
  }, [qParam]);

  // Load items from API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {
      page: pageParam,
      limit: 12,
    };
    if (typeParam && typeParam !== "all") params.type = typeParam;
    if (catParam && catParam !== "All Categories") params.category = catParam;
    if (qParam.trim()) params.q = qParam.trim();
    if (statusParam) params.status = statusParam;

    client
      .get("/lost-found", { params })
      .then(({ data }) => {
        if (!cancelled) {
          setItems(data.items || []);
          setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          const msg =
            err.response?.data?.error?.message ||
            "Unable to load lost and found items. Please try again.";
          setError(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [typeParam, catParam, qParam, statusParam, pageParam]);

  function updateParams(updates) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "" || v === "all" || v === "All Categories") {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    // Reset page to 1 unless page itself was updated
    if (!("page" in updates)) {
      next.delete("page");
    }
    setSearchParams(next);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateParams({ q: inputVal.trim() });
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner with Call to Actions */}
      <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/95 via-white/85 to-slate-100/90 p-6 sm:p-8 shadow-xs backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs">
              <Icon name="lost_found" className="h-3.5 w-3.5 text-slate-900" />
              <span>Campus Ecosystem Service</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Campus Lost &amp; Found
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Report lost belongings, find items turned in across campus, discover smart automated
              matches, and safely recover your property within your university.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              className="px-5 shadow-md"
              onClick={() => {
                if (!user) navigate("/login");
                else navigate("/lost-found/new?type=lost");
              }}
            >
              <Icon name="search" className="h-4 w-4" />
              <span>+ Report Lost Item</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="px-5 border-emerald-200 hover:border-emerald-300 text-emerald-800"
              onClick={() => {
                if (!user) navigate("/login");
                else navigate("/lost-found/new?type=found");
              }}
            >
              <Icon name="checkCircle" className="h-4 w-4 text-emerald-600" />
              <span>+ Report Found Item</span>
            </Button>

            {user && (
              <Button
                variant="outline"
                size="lg"
                className="px-4"
                onClick={() => navigate("/lost-found/my-items")}
              >
                <Icon name="dashboard" className="h-4 w-4" />
                <span>My Items &amp; Matches</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass rounded-3xl border border-white/80 bg-white/75 p-5 shadow-xs backdrop-blur-xl space-y-4">
        {/* Search Input Row */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search by item name, description, brand, or campus location…"
              className="glass-input w-full rounded-2xl bg-white/90 border border-slate-200/90 py-2.5 pl-12 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none shadow-xs transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal("");
                  updateParams({ q: "" });
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" className="px-5">
            Search
          </Button>
        </form>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/60 pt-4">
          {/* Type Tabs */}
          <div className="overflow-x-auto thin-scrollbar">
            <Tabs
              items={TYPE_TABS}
              value={typeParam}
              onChange={(newType) => updateParams({ type: newType })}
            />
          </div>

          {/* Category & Status Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <select
              value={catParam || "All Categories"}
              onChange={(e) => updateParams({ category: e.target.value })}
              className="glass-input rounded-xl bg-white/90 border border-slate-200/90 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusParam}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="glass-input rounded-xl bg-white/90 border border-slate-200/90 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="matched">Matched</option>
              <option value="claim_pending">Claim Pending</option>
              <option value="returned">Returned / Recovered</option>
            </select>

            {/* Reset Filters */}
            {(typeParam !== "all" || catParam || qParam || statusParam) && (
              <button
                type="button"
                onClick={() => {
                  setInputVal("");
                  setSearchParams({});
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition underline underline-offset-2"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <ErrorBanner title="Failed to load items" message={error} onClose={() => setError(null)} />
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="glass flex flex-col rounded-[22px] border border-white/80 bg-white/75 p-4 shadow-xs space-y-3"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
              <div className="mt-auto pt-2 flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="lost_found"
          title="No lost or found items found"
          subtitle={
            qParam || catParam || typeParam !== "all" || statusParam
              ? "No items match your active filters. Try adjusting your query or resetting the filters."
              : "No lost or found belongings have been reported yet for your campus."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!user) navigate("/login");
                  else navigate("/lost-found/new?type=lost");
                }}
              >
                Report Lost Item
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!user) navigate("/login");
                  else navigate("/lost-found/new?type=found");
                }}
              >
                Report Found Item
              </Button>
              {(qParam || catParam || typeParam !== "all" || statusParam) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInputVal("");
                    setSearchParams({});
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* Items Grid */}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {items.length} of {pagination.total} reports
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {items.map((item) => (
              <LostFoundCard key={item.id} item={item} />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateParams({ page: pagination.page - 1 })}
              >
                <Icon name="arrowLeft" className="h-4 w-4" />
                <span>Previous</span>
              </Button>

              <div className="flex items-center gap-1 px-3 py-1 rounded-xl glass text-xs font-semibold text-slate-700">
                Page {pagination.page} of {pagination.totalPages}
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateParams({ page: pagination.page + 1 })}
              >
                <span>Next</span>
                <Icon name="arrowRight" className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
