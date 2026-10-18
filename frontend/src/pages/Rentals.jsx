import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";
import { RentalCard } from "../components/cards";
import Icon from "../components/Icon";

export default function Rentals() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    client.get("/meta/categories").then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      client
        .get("/rentals", { params: { q: q || undefined, category: category || undefined } })
        .then(({ data }) => setItems(data.items));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div>
      <PageHeader
        title="Borrow & Rent"
        subtitle="Books, calculators, projectors, and more — borrowed from fellow students."
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
              aria-label="Search rentals"
              placeholder="Search rentals…"
              className="w-full sm:w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {user?.role === "student" && <Button as={Link} to="/rentals/new">List an item</Button>}
            {user && <Button as={Link} to="/rentals/mine" variant="outline">My bookings</Button>}
          </div>
        }
      />

      {user?.university_name && (
        <div className="mb-4">
          <Badge tone="slate">Campus: {user.university_name}</Badge>
        </div>
      )}

      {!items ? (
        <LoadingState label="Loading rentals…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No rental items yet"
          subtitle="Try a different search term or category."
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
          {items.map((it) => (
            <RentalCard key={it.id} rental={it} />
          ))}
        </div>
      )}
    </div>
  );
}
