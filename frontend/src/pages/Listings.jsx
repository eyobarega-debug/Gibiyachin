import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";
import { MediaImage } from "../components/cards";
import Icon from "../components/Icon";

export default function Listings() {
  const { user } = useAuth();
  const [listings, setListings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    client.get("/meta/categories").then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      client
        .get("/listings", { params: { q: q || undefined, category: category || undefined } })
        .then(({ data }) => setListings(data.listings));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div>
      <PageHeader
        title="Student Marketplace"
        subtitle="Items students are selling directly to other students."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-36"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input
              aria-label="Search listings"
              placeholder="Search listings…"
              className="w-full sm:w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {user?.role === "student" && <Button as={Link} to="/listings/new">Sell an item</Button>}
          </div>
        }
      />

      {user?.university_name && (
        <div className="mb-4">
          <Badge tone="slate">Campus: {user.university_name}</Badge>
        </div>
      )}

      {!listings ? (
        <LoadingState label="Loading listings…" />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          subtitle="Be the first to list an item for sale."
          action={
            (q || category) && (
              <Button variant="outline" onClick={() => { setQ(""); setCategory(""); }}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              to={`/listings/${l.id}`}
              className="glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/20" />
                <MediaImage
                  src={l.images?.[0]}
                  alt={l.title}
                  icon="listings"
                  className="transition duration-500 group-hover:scale-[1.06]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />
                {l.condition && (
                  <span className="absolute bottom-3 left-3 rounded-lg border border-white/15 bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                    {l.condition}
                  </span>
                )}
                {l.status === "pending_review" && (
                  <span className="absolute right-3 top-3">
                    <Badge tone="warn">Under review</Badge>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 font-semibold leading-snug text-ink">{l.title}</h3>
                <p className="mt-1 text-xs text-muted">by {l.seller_name}</p>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <span className="text-lg font-bold tracking-tight text-ink">
                    {Number(l.price).toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-muted">ETB</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-ink opacity-80 transition group-hover:gap-2 group-hover:opacity-100">
                    View <Icon name="arrowRight" className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
