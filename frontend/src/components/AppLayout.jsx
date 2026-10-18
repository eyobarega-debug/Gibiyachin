import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { client } from "../api/client";
import { Badge } from "./ui";
import Icon from "./Icon";
import { visibleTabs } from "../config/roles";

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */
function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-b from-white to-[#c3ccd8] text-lg font-bold text-[#0b0d11] shadow-[0_8px_20px_-10px_rgba(255,255,255,0.7),inset_0_1px_0_rgba(255,255,255,0.9)]">
        ግ
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-mirror text-base font-bold tracking-tight">ግቢያችን</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
          Gibiyachin
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */
function navItemClass({ isActive }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
    isActive
      ? "border border-white/15 bg-white/10 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_16px_32px_-22px_rgba(255,255,255,0.55)]"
      : "border border-transparent text-muted hover:border-white/8 hover:bg-white/5 hover:text-ink"
  }`;
}

function SideNav({ user, onNavigate }) {
  const tabs = useMemo(() => visibleTabs(user), [user]);
  const sections = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const t of tabs) {
      const key = t.section || "Browse";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key).push(t);
    }
    return order.map((name) => ({ name, tabs: map.get(name) }));
  }, [tabs]);

  return (
    <nav className="flex flex-col gap-5 p-3">
      {sections.map((section) => (
        <div key={section.name}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/70">
            {section.name}
          </p>
          <div className="flex flex-col gap-1">
            {section.tabs.map((t) => (
              <NavLink key={t.key} to={t.to} end={t.to === "/"} className={navItemClass} onClick={onNavigate}>
                <Icon name={t.icon || t.key} className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{t.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {user && (
        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/70">
            Account
          </p>
          <div className="flex flex-col gap-1">
            <NavLink to="/profile" end className={navItemClass} onClick={onNavigate}>
              <Icon name="user" className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">Profile</span>
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Unread notifications polling                                        */
/* ------------------------------------------------------------------ */
function useUnread(user) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const { data } = await client.get("/notifications", { params: { unreadOnly: true } });
        if (!cancelled) setUnread(data.unreadCount || 0);
      } catch {
        /* ignore polling errors */
      }
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
  return unread;
}

/* ------------------------------------------------------------------ */
/* User menu                                                           */
/* ------------------------------------------------------------------ */
function roleLabel(role) {
  return (
    {
      student: "Student",
      merchant: "Merchant",
      organizer: "Event Organizer",
      admin: "Campus Admin",
      super_admin: "Super Admin",
    }[role] || "Member"
  );
}

function UserMenu({ user, unread, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initial = user.name?.[0]?.toUpperCase() || "U";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 py-1 pl-1 pr-2.5 transition hover:border-white/20 hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b from-white to-[#c3ccd8] text-xs font-bold text-[#0b0d11]">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] flex-col items-start leading-tight sm:flex">
          <span className="truncate text-sm font-medium text-ink">{user.name?.split(" ")[0]}</span>
          <span className="truncate text-[10px] text-muted">{roleLabel(user.role)}</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-strong animate-rise absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="border-b border-white/8 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{roleLabel(user.role)}</Badge>
              {user.verified && <Badge tone="ok">Verified</Badge>}
              {user.university_name && <Badge tone="slate">{user.university_name}</Badge>}
            </div>
          </div>
          <div className="p-1.5">
            <MenuLink to="/profile" icon="user" onClick={() => setOpen(false)}>
              My Profile
            </MenuLink>
            <MenuLink to="/notifications" icon="bell" onClick={() => setOpen(false)} badge={unread}>
              Notifications
            </MenuLink>
          </div>
          <div className="border-t border-white/8 p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
            >
              <Icon name="logout" className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon, children, onClick, badge }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/8 hover:text-ink"
    >
      <Icon name={icon} className="h-4 w-4" />
      <span className="flex-1">{children}</span>
      {badge > 0 && <Badge tone="accent">{badge}</Badge>}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */
function SearchBox({ className = "", onDone }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/marketplace?q=${encodeURIComponent(term)}` : "/marketplace");
    setQ("");
    onDone?.();
  }

  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products, events, rentals…"
        aria-label="Search the marketplace"
        className="glass-input w-full rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-white/35 focus:ring-2 focus:ring-white/15"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile drawer + bottom nav                                          */
/* ------------------------------------------------------------------ */
function MobileDrawer({ open, onClose, user, unread, onLogout }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="glass-strong absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
          <Brand onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-white/8 hover:text-ink"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-white/8 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="accent">{roleLabel(user.role)}</Badge>
              {user.university_name && <Badge tone="slate">{user.university_name}</Badge>}
            </div>
          </div>
        )}

        <div className="flex-1">
          <SideNav user={user} onNavigate={onClose} />
        </div>

        <div className="border-t border-white/8 p-3">
          {user ? (
            <div className="flex flex-col gap-1">
              <NavLink to="/notifications" onClick={onClose} className={navItemClass}>
                <Icon name="bell" className="h-[18px] w-[18px]" />
                Notifications
                {unread > 0 && (
                  <Badge tone="accent" className="ml-auto">
                    {unread}
                  </Badge>
                )}
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
              >
                <Icon name="logout" className="h-[18px] w-[18px]" />
                Log out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                onClick={onClose}
                className="rounded-xl border border-white/12 px-3 py-2.5 text-center text-sm font-medium text-ink transition hover:bg-white/8"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="rounded-xl bg-gradient-to-b from-white to-[#cbd5e1] px-3 py-2.5 text-center text-sm font-medium text-[#0b0d11]"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ user }) {
  const items = [
    { to: "/", label: "Home", icon: "home", end: true },
    { to: "/marketplace", label: "Shop", icon: "marketplace" },
    { to: "/rentals", label: "Rent", icon: "rentals" },
    { to: "/events", label: "Events", icon: "events" },
    user
      ? { to: "/profile", label: "Profile", icon: "user" }
      : { to: "/login", label: "Log in", icon: "user" },
  ];
  return (
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-white/8 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition ${
              isActive ? "text-ink" : "text-muted"
            }`
          }
        >
          <Icon name={it.icon} className="h-5 w-5" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
export { roleLabel };

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unread = useUnread(user);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-full">
      <div className="bg-depth" aria-hidden="true">
        <div className="bg-grid" />
        <div className="bg-streak" />
      </div>

      <header className="glass-strong sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-xl p-2 text-muted transition hover:bg-white/8 hover:text-ink lg:hidden"
            aria-label="Open navigation menu"
          >
            <Icon name="menu" />
          </button>

          <Brand />

          <div className="mx-auto hidden w-full max-w-xl px-6 md:block">
            <SearchBox />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            {user ? (
              <>
                <Link
                  to="/notifications"
                  className="glass relative flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:text-ink"
                  aria-label="Notifications"
                >
                  <Icon name="bell" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gradient-to-b from-white to-[#cbd5e1] px-1 text-[10px] font-bold text-[#0b0d11] ring-2 ring-[#0e1015]">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <UserMenu user={user} unread={unread} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/8 hover:text-ink"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-gradient-to-b from-white to-[#cbd5e1] px-4 py-2 text-sm font-medium text-[#0b0d11] shadow-[0_10px_30px_-14px_rgba(255,255,255,0.5)] transition hover:to-white"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBox onDone={() => setDrawerOpen(false)} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-white/8 bg-white/[0.02] backdrop-blur-sm lg:flex">
          <div className="px-5 pb-3 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/70">
              University Marketplace
            </p>
            <p className="mt-0.5 text-[11px] text-muted/70">Buy • Sell • Rent • Connect</p>
          </div>
          <div className="hairline mx-5 h-px" />
          <SideNav user={user} />
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div key={location.pathname} className="animate-fade">
              {children}
            </div>
          </div>
        </main>
      </div>

      <BottomNav user={user} />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        unread={unread}
        onLogout={handleLogout}
      />
    </div>
  );
}
