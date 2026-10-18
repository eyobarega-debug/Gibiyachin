import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Button, EmptyState, LoadingState, Select } from "../components/ui";
import { ProductCard } from "../components/cards";
import Icon from "../components/Icon";

export default function Marketplace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const storeId = searchParams.get("store") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";

  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [qInput, setQInput] = useState(q);

  function updateParams(patch) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    client.get("/meta/categories").then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // Keep the local search box in sync when the URL changes (e.g. global search).
  useEffect(() => {
    setQInput(q);
  }, [q]);

  // Debounce the search box into the URL.
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => updateParams({ q: qInput || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  useEffect(() => {
    setProducts(null);
    const t = setTimeout(() => {
      client
        .get("/products", {
          params: {
            q: q || undefined,
            category: category || undefined,
            storeId: storeId || undefined,
            minPrice: minPrice || undefined,
            maxPrice: maxPrice || undefined,
          },
        })
        .then(({ data }) => setProducts(data.products || []))
        .catch(() => setProducts([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q, category, storeId, minPrice, maxPrice]);

  const hasFilters = q || category || storeId || minPrice || maxPrice;

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Marketplace</h1>
          <p className="mt-1 text-sm text-muted">
            Discover products, rentals and services from your campus community.
          </p>
        </div>
        {user?.university_name && (
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink">
            <Icon name="university" className="h-3.5 w-3.5 text-muted" />
            {user.university_name}
          </span>
        )}
      </div>

      {/* Unified frosted search & filter panel */}
      <div className="glass-panel mb-6 rounded-2xl p-2.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search products…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-white/35 focus:ring-2 focus:ring-white/15"
            />
          </div>

          <div className="hidden h-9 w-px shrink-0 bg-white/10 lg:block" />

          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => updateParams({ category: e.target.value })}
            className="w-full lg:w-44"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <div className="hidden h-9 w-px shrink-0 bg-white/10 lg:block" />

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="Min"
              aria-label="Minimum price"
              value={minPrice}
              onChange={(e) => updateParams({ minPrice: e.target.value })}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none transition focus:border-white/35 focus:ring-2 focus:ring-white/15 lg:w-24"
            />
            <span className="text-muted">–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              aria-label="Maximum price"
              value={maxPrice}
              onChange={(e) => updateParams({ maxPrice: e.target.value })}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none transition focus:border-white/35 focus:ring-2 focus:ring-white/15 lg:w-24"
            />
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQInput("");
                setSearchParams({}, { replace: true });
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {storeId && (
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-muted">
            <span>Showing products from a single seller.</span>
            <Link to="/marketplace" className="font-medium text-ink underline decoration-white/30">
              Clear filter
            </Link>
          </div>
        )}
      </div>

      {!products ? (
        <LoadingState label="Loading products…" />
      ) : products.length === 0 ? (
        <EmptyState
          icon="marketplace"
          title="No products found"
          subtitle="Try a different search term, category or price range."
          action={
            hasFilters && (
              <Button
                variant="outline"
                onClick={() => {
                  setQInput("");
                  setSearchParams({}, { replace: true });
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">{products.length} product{products.length === 1 ? "" : "s"}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
