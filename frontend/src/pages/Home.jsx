import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Button, Card, Skeleton } from "../components/ui";
import { ProductCard, EventCard, StatCard, CategoryCard } from "../components/cards";
import Icon from "../components/Icon";

function categoryIcon(name = "") {
  const n = name.toLowerCase();
  if (/book|station|paper|note/.test(n)) return "file";
  if (/electr|phone|laptop|computer|gadget/.test(n)) return "sparkles";
  if (/sport|game|fit/.test(n)) return "star";
  if (/rent|borrow|tool/.test(n)) return "rentals";
  return "marketplace";
}

const QUICK_ACTIONS = {
  guest: [
    { to: "/register", icon: "user", label: "Create account", desc: "Join your campus marketplace" },
    { to: "/marketplace", icon: "marketplace", label: "Browse marketplace", desc: "Explore verified merchants" },
    { to: "/events", icon: "events", label: "Explore events", desc: "Find tickets to campus happenings" },
    { to: "/rentals", icon: "rentals", label: "Borrow & rent", desc: "Gear, books and equipment" },
  ],
  student: [
    { to: "/marketplace", icon: "marketplace", label: "Browse marketplace", desc: "Buy from verified merchants" },
    { to: "/rentals/new", icon: "rentals", label: "Request rental", desc: "Borrow what you need" },
    { to: "/orders", icon: "orders", label: "My orders", desc: "Track purchases & pickup" },
    { to: "/tickets", icon: "tickets", label: "My tickets", desc: "Your QR event passes" },
  ],
  merchant: [
    { to: "/merchant", icon: "products", label: "Post product", desc: "Add to your storefront" },
    { to: "/merchant", icon: "store", label: "Manage products", desc: "Stock, pricing & listings" },
    { to: "/orders", icon: "orders", label: "View orders", desc: "Fulfilment & confirmations" },
    { to: "/seller", icon: "user", label: "Store profile", desc: "Your public storefront" },
  ],
  organizer: [
    { to: "/organizer", icon: "events", label: "Create event", desc: "Publish a new happening" },
    { to: "/organizer", icon: "dashboard", label: "Manage events", desc: "Draft, publish & edit" },
    { to: "/tickets/verify", icon: "qr", label: "Scan tickets", desc: "Check attendees in" },
    { to: "/organizer", icon: "attendees", label: "Attendees", desc: "Sales & check-in stats" },
  ],
  admin: [
    { to: "/admin", icon: "user", label: "Manage users", desc: "Accounts & roles" },
    { to: "/admin", icon: "verification", label: "Verify accounts", desc: "Campus verification queue" },
    { to: "/payment-approvals", icon: "payments", label: "Payment verification", desc: "Approve manual proofs" },
    { to: "/admin", icon: "reports", label: "Reports & moderation", desc: "Platform oversight" },
  ],
};

function quickActionsFor(user) {
  if (!user) return QUICK_ACTIONS.guest;
  if (user.role === "admin" || user.role === "super_admin") return QUICK_ACTIONS.admin;
  return QUICK_ACTIONS[user.role] || QUICK_ACTIONS.student;
}

export default function Home() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [events, setEvents] = useState(null);
  const [listings, setListings] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client.get("/meta/categories").then(({ data }) => !cancelled && setCategories(data.categories || [])).catch(() => {});
    client.get("/products").then(({ data }) => !cancelled && setProducts(data.products || [])).catch(() => !cancelled && setProducts([]));
    client.get("/events").then(({ data }) => !cancelled && setEvents(data.events || [])).catch(() => !cancelled && setEvents([]));
    client.get("/listings").then(({ data }) => !cancelled && setListings(data.listings || [])).catch(() => !cancelled && setListings([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = (products || []).filter((p) => p.is_featured);
  const productShowcase = (featured.length ? featured : products || []).slice(0, 8);
  const upcoming = [...(events || [])]
    .sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
    .slice(0, 3);

  const stats = [
    { icon: "marketplace", label: "Products", value: products == null ? "—" : `${products.length}${products.length >= 20 ? "+" : ""}` },
    { icon: "events", label: "Events", value: events == null ? "—" : `${events.length}` },
    { icon: "listings", label: "P2P Listings", value: listings == null ? "—" : `${listings.length}` },
    { icon: "filter", label: "Categories", value: categories.length ? `${categories.length}` : "—" },
  ];

  const actions = quickActionsFor(user);

  return (
    <div className="animate-rise space-y-12">
      {/* Hero ---------------------------------------------------------- */}
      <section className="glass-panel relative overflow-hidden rounded-[32px] p-8 sm:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(70% 80% at 60% 20%, #000, transparent 75%)",
            WebkitMaskImage: "radial-gradient(70% 80% at 60% 20%, #000, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-[#7d91af]/14 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted">
              <Icon name="university" className="h-3.5 w-3.5" />
              {user?.university_name || "University Marketplace & Campus Services Platform"}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.03] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Your Campus <span className="text-mirror">Marketplace</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Buy, sell, rent, and discover everything you need — all in one place. Verified merchants,
              secure QR event tickets and trusted campus services.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button as={Link} to="/marketplace" size="lg">
                Explore Marketplace
                <Icon name="arrowRight" className="h-4 w-4" />
              </Button>
              <Button as={Link} to="/events" variant="outline" size="lg">
                Explore Events
              </Button>
            </div>
            {!user && (
              <p className="mt-4 text-sm text-muted">
                New here?{" "}
                <Link to="/register" className="font-medium text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white">
                  Create an account
                </Link>{" "}
                to buy, sell and rent on campus.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} className="min-w-0" />
            ))}
          </div>
        </div>
      </section>

      {/* Categories ---------------------------------------------------- */}
      {categories.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Browse by category</h2>
              <p className="text-sm text-muted">Find exactly what you need, faster.</p>
            </div>
            <Link to="/marketplace" className="hidden items-center gap-1 text-sm font-medium text-muted transition hover:text-ink sm:flex">
              View all <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 5).map((c) => (
              <CategoryCard key={c.id} icon={categoryIcon(c.name)} label={c.name} to={`/marketplace?category=${c.id}`} />
            ))}
            <CategoryCard icon="rentals" label="Rentals & Borrowing" to="/rentals" />
            <CategoryCard icon="events" label="Events & Tickets" to="/events" />
          </div>
        </section>
      )}

      {/* Featured products -------------------------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {featured.length ? "Featured Products" : "Fresh in the Marketplace"}
            </h2>
            <p className="text-sm text-muted">Handpicked from verified campus merchants.</p>
          </div>
          <Link to="/marketplace" className="flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink">
            View All <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>

        {products == null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : productShowcase.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">No products are listed yet. Check back soon.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productShowcase.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Events -------------------------------------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">Upcoming Events</h2>
            <p className="text-sm text-muted">Secure your spot with QR-verified tickets.</p>
          </div>
          <Link to="/events" className="flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink">
            View All <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>

        {events == null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">No published events right now. Check back soon.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      {/* Quick actions ------------------------------------------------- */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-ink">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} to={a.to} className="glass glass-hover group flex items-start gap-3 rounded-2xl p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-ink">
                <Icon name={a.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{a.label}</span>
                <span className="block text-xs text-muted">{a.desc}</span>
              </span>
              <Icon
                name="chevronRight"
                className="ml-auto h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
