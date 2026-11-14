import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { ProductCard, ListingCard, RentalCard, EventCard, LostFoundCard } from "../components/cards";
import { Tabs, EmptyState, Skeleton, ErrorBanner, Button, Badge } from "../components/ui";
import Icon from "../components/Icon";
import { addRecentSearch } from "../utils/recentSearches";

const TABS = [
  { key: "all", label: "All" },
  { key: "products", label: "Products" },
  { key: "listings", label: "Student Market" },
  { key: "rentals", label: "Rentals" },
  { key: "events", label: "Events" },
  { key: "lost_found", label: "Lost & Found" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";
  const typeParam = searchParams.get("type") || "all";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const sortParam = searchParams.get("sort") || "relevance";

  const [inputVal, setInputVal] = useState(qParam);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync input value with URL query param
  useEffect(() => {
    setInputVal(qParam);
  }, [qParam]);

  // Record valid query into recent searches
  useEffect(() => {
    if (qParam.trim().length >= 2) {
      addRecentSearch(qParam.trim());
    }
  }, [qParam]);

  // Fetch search results whenever URL parameters change
  useEffect(() => {
    const term = qParam.trim();
    if (!term || term.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .get("/search", {
        params: {
          q: term,
          type: typeParam,
          page: pageParam,
          limit: 20,
          sort: sortParam,
        },
      })
      .then(({ data: resData }) => {
        if (!cancelled) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          const msg = err.response?.data?.error?.message || "Failed to load search results. Please try again.";
          setError(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qParam, typeParam, pageParam, sortParam]);

  // Handlers for URL updates
  function handleTabChange(newType) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("type", newType);
    nextParams.set("page", "1");
    setSearchParams(nextParams);
  }

  function handleSortChange(newSort) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sort", newSort);
    nextParams.set("page", "1");
    setSearchParams(nextParams);
  }

  function handlePageChange(newPage) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(newPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const clean = inputVal.trim();
    const nextParams = new URLSearchParams();
    if (clean) nextParams.set("q", clean);
    nextParams.set("type", typeParam);
    nextParams.set("page", "1");
    if (sortParam !== "relevance") nextParams.set("sort", sortParam);
    setSearchParams(nextParams);
  }

  const counts = data?.counts || { all: 0, products: 0, listings: 0, rentals: 0, events: 0, lost_found: 0 };
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const tabItems = useMemo(
    () =>
      TABS.map((t) => ({
        key: t.key,
        label: t.label,
        count: counts[t.key] != null ? counts[t.key] : null,
      })),
    [counts]
  );

  return (
    <div className="space-y-6">
      {/* Search Header Bar */}
      <div className="glass rounded-3xl border border-white/80 bg-white/75 p-6 shadow-xs backdrop-blur-xl">
        <form onSubmit={handleFormSubmit} className="relative flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search products, student listings, rentals, campus events…"
              className="glass-input w-full rounded-2xl bg-white/90 border border-slate-200/90 py-3 pl-12 pr-10 text-sm sm:text-base text-slate-800 placeholder-slate-400 outline-none shadow-xs transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => setInputVal("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                aria-label="Clear search input"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" size="lg" className="sm:w-auto px-6">
            <Icon name="search" className="h-4 w-4" />
            <span>Search</span>
          </Button>
        </form>

        {/* Results Metadata */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-4 text-xs sm:text-sm">
          <div>
            {qParam.trim() ? (
              <p className="text-slate-600">
                Search Results for <strong className="font-semibold text-slate-900">"{qParam}"</strong>
                {data && !loading && (
                  <span className="ml-2 text-slate-500 font-normal">
                    ({pagination.total} {pagination.total === 1 ? "result" : "results"} found)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-slate-500">Enter a keyword above to search across campus.</p>
            )}
          </div>

          {/* Sort Selector */}
          {qParam.trim().length >= 2 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs font-medium">Sort by:</span>
              <select
                value={sortParam}
                onChange={(e) => handleSortChange(e.target.value)}
                className="glass-input rounded-xl bg-white/80 border border-slate-200/90 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none transition focus:border-slate-400"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      {qParam.trim().length >= 2 && (
        <div className="overflow-x-auto thin-scrollbar pb-1">
          <Tabs items={tabItems} value={typeParam} onChange={handleTabChange} />
        </div>
      )}

      {/* Error State */}
      {error && (
        <ErrorBanner
          title="Search Failed"
          message={error}
          onClose={() => setError(null)}
        />
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

      {/* Empty State: Query too short or missing */}
      {!loading && !error && (!qParam.trim() || qParam.trim().length < 2) && (
        <EmptyState
          icon="search"
          title="Search Gibiyachin Marketplace"
          subtitle="Explore campus products, student peer-to-peer listings, equipment rentals, and upcoming university events."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Popular:</span>
              {["Laptop", "Calculator", "Charger", "Hackathon", "Projector"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setInputVal(term);
                    setSearchParams({ q: term, type: "all" });
                  }}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-700 hover:bg-white transition"
                >
                  {term}
                </button>
              ))}
            </div>
          }
        />
      )}

      {/* Empty State: No results found */}
      {!loading && !error && qParam.trim().length >= 2 && data && pagination.total === 0 && (
        <EmptyState
          icon="search"
          title={`No results found for "${qParam}"`}
          subtitle="We couldn't find any items matching your search. Check for spelling errors, try broader keywords, or browse other categories."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => handleTabChange("all")}>
                View All Categories
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputVal("");
                  setSearchParams({});
                }}
              >
                Clear Search
              </Button>
            </div>
          }
        />
      )}

      {/* Results View */}
      {!loading && !error && data && pagination.total > 0 && (
        <>
          {/* Specific Type View: Paginated Grid */}
          {typeParam !== "all" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {data.results.map((item) => (
                <SearchResultCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}

          {/* "All" Tab View: Categorized Sections with Previews */}
          {typeParam === "all" && (
            <div className="space-y-10">
              {/* Products Section */}
              {data.grouped?.products?.length > 0 && (
                <CategorySection
                  title="Campus Products"
                  icon="marketplace"
                  count={counts.products}
                  onViewAll={() => handleTabChange("products")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {data.grouped.products.slice(0, 4).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </CategorySection>
              )}

              {/* Student Market (P2P Listings) */}
              {data.grouped?.listings?.length > 0 && (
                <CategorySection
                  title="Student Market"
                  icon="listings"
                  count={counts.listings}
                  onViewAll={() => handleTabChange("listings")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {data.grouped.listings.slice(0, 4).map((l) => (
                      <ListingCard key={l.id} listing={l} />
                    ))}
                  </div>
                </CategorySection>
              )}

              {/* Rentals Section */}
              {data.grouped?.rentals?.length > 0 && (
                <CategorySection
                  title="Rentals & Equipment"
                  icon="rentals"
                  count={counts.rentals}
                  onViewAll={() => handleTabChange("rentals")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {data.grouped.rentals.slice(0, 4).map((r) => (
                      <RentalCard key={r.id} rental={r} />
                    ))}
                  </div>
                </CategorySection>
              )}

              {/* Events Section */}
              {data.grouped?.events?.length > 0 && (
                <CategorySection
                  title="Campus Events"
                  icon="events"
                  count={counts.events}
                  onViewAll={() => handleTabChange("events")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {data.grouped.events.slice(0, 4).map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </CategorySection>
              )}

              {/* Lost & Found Section */}
              {data.grouped?.lost_found?.length > 0 && (
                <CategorySection
                  title="Campus Lost & Found"
                  icon="lost_found"
                  count={counts.lost_found}
                  onViewAll={() => handleTabChange("lost_found")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {data.grouped.lost_found.slice(0, 4).map((lf) => (
                      <LostFoundCard key={lf.id} item={lf} />
                    ))}
                  </div>
                </CategorySection>
              )}
            </div>
          )}

          {/* Pagination Controls for Specific Type View */}
          {typeParam !== "all" && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
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
                onClick={() => handlePageChange(pagination.page + 1)}
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

/* ------------------------------------------------------------------ */
/* Category Section Header Wrapper                                     */
/* ------------------------------------------------------------------ */
function CategorySection({ title, icon, count, onViewAll, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/70">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {count != null && <Badge tone="slate">{count}</Badge>}
        </div>
        {count > 4 && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <span>View all ({count})</span>
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Generic Item Dispatcher Card                                        */
/* ------------------------------------------------------------------ */
function SearchResultCard({ item }) {
  if (item.type === "product") return <ProductCard product={item} />;
  if (item.type === "listing") return <ListingCard listing={item} />;
  if (item.type === "rental") return <RentalCard rental={item} />;
  if (item.type === "event") return <EventCard event={item} />;
  if (item.type === "lost_found") return <LostFoundCard item={item} />;
  return null;
}
