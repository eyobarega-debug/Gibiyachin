import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import { Button, Card, Skeleton } from "../components/ui";
import { ProductCard, EventCard, StatCard, CategoryCard, RentalCard, ListingCard } from "../components/cards";
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
  const { promptAuth } = useAuthPrompt();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [events, setEvents] = useState(null);
  const [listings, setListings] = useState(null);
  const [rentals, setRentals] = useState(null);

  function handleTabClick(e, destination, badge, description) {
    if (!user) {
      e.preventDefault();
      promptAuth({
        to: destination,
        badge: badge || "Campus Services",
        description:
          description ||
          "Join your campus community to browse verified listings, borrow & rent equipment, and access QR-verified event tickets.",
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    client.get("/meta/categories").then(({ data }) => !cancelled && setCategories(data.categories || [])).catch(() => {});
    client.get("/products").then(({ data }) => !cancelled && setProducts(data.products || [])).catch(() => !cancelled && setProducts([]));
    client.get("/events").then(({ data }) => !cancelled && setEvents(data.events || [])).catch(() => !cancelled && setEvents([]));
    client.get("/listings").then(({ data }) => !cancelled && setListings(data.listings || [])).catch(() => !cancelled && setListings([]));
    client.get("/rentals").then(({ data }) => !cancelled && setRentals(data.items || [])).catch(() => !cancelled && setRentals([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = (products || []).filter((p) => p.is_featured);
  const productShowcase = (featured.length ? featured : products || []).slice(0, 4);
  const upcoming = [...(events || [])]
    .sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
    .slice(0, 3);
  const popularRentals = (rentals || []).slice(0, 2);
  const recentListings = (listings || []).slice(0, 2);

  const stats = [
    { icon: "marketplace", label: "Products", value: products == null ? "—" : `${products.length}${products.length >= 20 ? "+" : ""}`, to: "/marketplace" },
    { icon: "events", label: "Events", value: events == null ? "—" : `${events.length}`, to: "/events" },
    { icon: "listings", label: "P2P Listings", value: listings == null ? "—" : `${listings.length}`, to: "/listings" },
    { icon: "filter", label: "Categories", value: categories.length ? `${categories.length}` : "—", to: "/marketplace" },
  ];

  const actions = quickActionsFor(user);

  return (
    <div className="animate-rise space-y-12">
      {/* Hero ---------------------------------------------------------- */}
      <section className="glass-panel relative overflow-hidden rounded-[32px] p-8 sm:p-12 border border-white/90">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(70% 80% at 60% 20%, #000, transparent 75%)",
            WebkitMaskImage: "radial-gradient(70% 80% at 60% 20%, #000, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-slate-300/40 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)" }}
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="glass inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
              <Icon name="university" className="h-3.5 w-3.5 text-slate-500" />
              {user?.university_name || "AASTU Campus • Verified Marketplace"}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Your Campus <span className="text-mirror">Marketplace</span>
            </h1>
            <p className="mt-3 text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
              Buy • Sell • Rent • Connect
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Buy, sell, rent, and discover everything you need — all in one place. Verified merchants,
              secure QR event tickets and trusted campus services.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                as={Link}
                to="/marketplace"
                size="lg"
                onClick={(e) =>
                  handleTabClick(
                    e,
                    "/marketplace",
                    "Marketplace",
                    "Explore verified products from university campus merchants."
                  )
                }
              >
                Explore Marketplace
                <Icon name="arrowRight" className="h-4 w-4" />
              </Button>
              <Button
                as={Link}
                to="/events"
                variant="secondary"
                size="lg"
                onClick={(e) =>
                  handleTabClick(
                    e,
                    "/events",
                    "Events",
                    "Find and secure QR-verified passes for campus events and workshops."
                  )
                }
              >
                Explore Events
              </Button>
            </div>
            {!user && (
              <p className="mt-4 text-sm text-slate-500">
                New here?{" "}
                <Link
                  to="/register"
                  onClick={(e) => handleTabClick(e, "/register", "Sign Up", "Create your campus account to buy, sell, and rent on campus.")}
                  className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800"
                >
                  Create an account
                </Link>{" "}
                to buy, sell and rent on campus.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                icon={s.icon}
                label={s.label}
                value={s.value}
                to={s.to}
                onClick={(e) => handleTabClick(e, s.to, s.label)}
                className="min-w-0"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Categories ---------------------------------------------------- */}
      {categories.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Browse by category</h2>
              <p className="text-sm text-slate-500">Find exactly what you need, faster.</p>
            </div>
            <Link
              to="/marketplace"
              onClick={(e) => handleTabClick(e, "/marketplace", "Categories")}
              className="hidden items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900 sm:flex"
            >
              View all <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 5).map((c) => (
              <CategoryCard
                key={c.id}
                icon={categoryIcon(c.name)}
                label={c.name}
                to={`/marketplace?category=${c.id}`}
                onClick={(e) => handleTabClick(e, `/marketplace?category=${c.id}`, c.name)}
              />
            ))}
            <CategoryCard
              icon="rentals"
              label="Rentals & Borrowing"
              to="/rentals"
              onClick={(e) =>
                handleTabClick(
                  e,
                  "/rentals",
                  "Rentals & Borrowing",
                  "Borrow electronics, lab gear, and textbooks from fellow students."
                )
              }
            />
            <CategoryCard
              icon="events"
              label="Events & Tickets"
              to="/events"
              onClick={(e) =>
                handleTabClick(
                  e,
                  "/events",
                  "Events & Tickets",
                  "Discover upcoming campus happenings and reserve tickets."
                )
              }
            />
          </div>
        </section>
      )}

      {/* Featured products -------------------------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {featured.length ? "Featured Products" : "Fresh in the Marketplace"}
            </h2>
            <p className="text-sm text-slate-500">Handpicked from verified campus merchants.</p>
          </div>
          <Link
            to="/marketplace"
            onClick={(e) => handleTabClick(e, "/marketplace", "Marketplace")}
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
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
          <Card className="p-8 text-center text-sm text-slate-500 border border-slate-200/80 bg-white/70">
            No products are listed yet. Check back soon.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productShowcase.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={(e) => handleTabClick(e, `/marketplace/${p.id}`, "Product", p.title)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Events -------------------------------------------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Upcoming Events</h2>
            <p className="text-sm text-slate-500">Secure your spot with QR-verified tickets.</p>
          </div>
          <Link
            to="/events"
            onClick={(e) => handleTabClick(e, "/events", "Events")}
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
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
          <Card className="p-8 text-center text-sm text-slate-500 border border-slate-200/80 bg-white/70">
            No published events right now. Check back soon.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                onClick={(e) => handleTabClick(e, `/events/${e.id}`, "Events", e.title)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Popular Rentals & Recent P2P ---------------------------------- */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Popular Rentals */}
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Popular Rentals</h2>
              <p className="text-sm text-slate-500">Gear, books &amp; equipment to borrow.</p>
            </div>
            <Link
              to="/rentals"
              onClick={(e) => handleTabClick(e, "/rentals", "Rentals")}
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Explore Rentals <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>

          {rentals == null ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : popularRentals.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500 border border-slate-200/80 bg-white/70">
              No equipment for rent at the moment.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {popularRentals.map((r) => (
                <RentalCard
                  key={r.id}
                  rental={r}
                  onClick={(e) => handleTabClick(e, `/rentals/${r.id}`, "Rentals", r.title)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent P2P */}
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Recent P2P Listings</h2>
              <p className="text-sm text-slate-500">Buy directly from fellow students.</p>
            </div>
            <Link
              to="/listings"
              onClick={(e) => handleTabClick(e, "/listings", "P2P Market")}
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Explore P2P <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>

          {listings == null ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : recentListings.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500 border border-slate-200/80 bg-white/70">
              No student listings yet. Be the first to post!
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recentListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  onClick={(e) => handleTabClick(e, `/listings/${l.id}`, "P2P Market", l.title)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Gibiyachin? Value Proposition Banner ------------------------ */}
      <section className="glass-panel rounded-3xl border border-white/90 p-8 sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Campus Trust &amp; Safety</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Why Gibiyachin?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            A verified platform designed specifically for university campus commerce and student life.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-xs transition hover:bg-white/90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Icon name="verification" className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Verified Merchants</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Sellers are authenticated with campus credentials, preventing fraud and scams.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-xs transition hover:bg-white/90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Icon name="payments" className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Secure Payments</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Direct Telebirr &amp; CBE Birr transfers with verified admin receipt approval.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-xs transition hover:bg-white/90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Icon name="university" className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Campus Community</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Built exclusively for university students, faculty, and campus campus life.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-xs transition hover:bg-white/90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Icon name="rentals" className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">Zero Rental Fees</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              0% commission on peer equipment rentals — borrow and lend without middleman fees.
            </p>
          </div>
        </div>
      </section>

      {/* Quick actions ------------------------------------------------- */}
      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              onClick={(e) => handleTabClick(e, a.to, a.label, a.desc)}
              className="glass glass-hover group flex items-start gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-xs transition hover:bg-white/95"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 shadow-xs">
                <Icon name={a.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{a.label}</span>
                <span className="block text-xs text-slate-500">{a.desc}</span>
              </span>
              <Icon
                name="chevronRight"
                className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-800"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
