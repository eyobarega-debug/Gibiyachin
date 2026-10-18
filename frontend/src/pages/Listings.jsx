import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";
import { ListingCard } from "../components/cards";
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
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
