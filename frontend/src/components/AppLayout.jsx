import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import { client } from "../api/client";
import { Badge } from "./ui";
import Icon from "./Icon";
import { visibleTabs } from "../config/roles";

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */
function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/90 bg-white/90 text-lg font-black text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.06)] transition duration-200 group-hover:scale-105">
        ግ
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-mirror text-lg font-extrabold tracking-tight">ግቢያችን</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          GIBIYACHIN
        </span>
        <span className="hidden xl:inline text-[9px] font-medium text-slate-400 tracking-normal mt-0.5">
          University Marketplace &amp; Campus Services
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */
function navItemClass({ isActive }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition duration-200 ${
    isActive
      ? "border border-white/90 bg-white text-slate-900 shadow-sm font-semibold"
      : "border border-transparent text-slate-600 hover:border-slate-200/60 hover:bg-white/60 hover:text-slate-900"
  }`;
}

function SideNav({ user, onNavigate }) {
  const { promptAuth } = useAuthPrompt();
  const location = useLocation();
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
              <NavLink
                key={t.key}
                to={t.to}
                end={t.end ?? t.to === "/"}
                className={navItemClass}
                onClick={(e) => {
                  if (!user && location.pathname === "/" && t.to !== "/") {
                    e.preventDefault();
                    onNavigate?.();
                    promptAuth({ to: t.to, badge: t.label });
                    return;
                  }
                  onNavigate?.();
                }}
              >
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
/* Onboarding status (merchant / organizer applications)               */
/* ------------------------------------------------------------------ */
function useOnboardingStatus(user) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!user || user.role !== "student") {
      setStatus(null);
      return;
    }
    let cancelled = false;
    client
      .get("/onboarding/status")
      .then(({ data }) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  return status;
}

function onboardingEntry(app, { applyTo, dashTo, label, icon }) {
  if (!app) return { to: applyTo, label: `Become a ${label}`, icon };
  if (app.status === "approved") return { to: dashTo, label: `${label} Dashboard`, icon: "dashboard" };
  if (app.status === "pending_review") {
    return { to: applyTo, label: `${label} Application`, icon: "clock", badge: "Pending", tone: "warn" };
  }
  return { to: applyTo, label: `${label} Application`, icon: "alert", badge: "Rejected", tone: "danger" };
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

function UserMenu({ user, unread, onLogout, onboarding }) {
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

  const merchantEntry =
    user.role === "student" &&
    onboardingEntry(onboarding?.merchant, {
      applyTo: "/merchant-apply",
      dashTo: "/merchant",
      label: "Merchant",
      icon: "store",
    });
  const organizerEntry =
    user.role === "student" &&
    onboardingEntry(onboarding?.organizer, {
      applyTo: "/organizer-apply",
      dashTo: "/organizer",
      label: "Organizer",
      icon: "events",
    });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/90 bg-white/80 py-1 pl-1 pr-2.5 shadow-sm transition hover:bg-white"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1c222c] text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] flex-col items-start leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-slate-800">{user.name?.split(" ")[0]}</span>
          <span className="truncate text-[10px] text-slate-500">{roleLabel(user.role)}</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-panel animate-rise absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-xl"
        >
          <div className="border-b border-slate-200/70 bg-slate-50/70 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
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
            <MenuLink to="/orders" icon="orders" onClick={() => setOpen(false)}>
              My Orders
            </MenuLink>
            <MenuLink to="/favorites" icon="favorites" onClick={() => setOpen(false)}>
              Saved Items
            </MenuLink>
            <MenuLink to="/notifications" icon="bell" onClick={() => setOpen(false)} badge={unread}>
              Notifications
            </MenuLink>
          </div>
          {(merchantEntry || organizerEntry) && (
            <div className="border-t border-slate-200/70 p-1.5">
              {merchantEntry && (
                <MenuLink
                  to={merchantEntry.to}
                  icon={merchantEntry.icon}
                  onClick={() => setOpen(false)}
                  badgeLabel={merchantEntry.badge}
                  badgeTone={merchantEntry.tone}
                >
                  {merchantEntry.label}
                </MenuLink>
              )}
              {organizerEntry && (
                <MenuLink
                  to={organizerEntry.to}
                  icon={organizerEntry.icon}
                  onClick={() => setOpen(false)}
                  badgeLabel={organizerEntry.badge}
                  badgeTone={organizerEntry.tone}
                >
                  {organizerEntry.label}
                </MenuLink>
              )}
            </div>
          )}
          <div className="border-t border-slate-200/70 p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-danger transition hover:bg-red-50"
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

function MenuLink({ to, icon, children, onClick, badge, badgeLabel, badgeTone }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon name={icon} className="h-4 w-4" />
      <span className="flex-1">{children}</span>
      {badgeLabel && <Badge tone={badgeTone || "slate"}>{badgeLabel}</Badge>}
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
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products, events, rentals…"
        aria-label="Search the marketplace"
        className="glass-input w-full rounded-full bg-white/80 border border-slate-200/90 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none shadow-xs transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile drawer + bottom nav                                          */
/* ------------------------------------------------------------------ */
function MobileDrawer({ open, onClose, user, unread, onLogout, onboarding }) {
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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="glass-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200/80 bg-white/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3.5">
          <Brand onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-slate-200/70 bg-slate-50/50 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="accent">{roleLabel(user.role)}</Badge>
              {user.university_name && <Badge tone="slate">{user.university_name}</Badge>}
            </div>
          </div>
        )}

        <div className="flex-1">
          <SideNav user={user} onNavigate={onClose} />
        </div>

        <div className="border-t border-slate-200/70 p-3">
          {user ? (
            <div className="flex flex-col gap-1">
              {user.role === "student" && (
                <>
                  {(() => {
                    const entries = [
                      onboardingEntry(onboarding?.merchant, {
                        applyTo: "/merchant-apply",
                        dashTo: "/merchant",
                        label: "Merchant",
                        icon: "store",
                      }),
                      onboardingEntry(onboarding?.organizer, {
                        applyTo: "/organizer-apply",
                        dashTo: "/organizer",
                        label: "Organizer",
                        icon: "events",
                      }),
                    ];
                    return entries.map((entry) => (
                      <NavLink key={entry.label} to={entry.to} onClick={onClose} className={navItemClass}>
                        <Icon name={entry.icon || "compass"} className="h-[18px] w-[18px]" />
                        <span className="truncate">{entry.label}</span>
                        {entry.badge && (
                          <Badge tone={entry.tone || "slate"} className="ml-auto">
                            {entry.badge}
                          </Badge>
                        )}
                      </NavLink>
                    ));
                  })()}
                  <div className="hairline mx-1 my-1 h-px" />
                </>
              )}
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-red-50"
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-slate-800 shadow-xs transition hover:bg-slate-50"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="rounded-xl bg-[#1c222c] hover:bg-[#2c3545] px-3 py-2.5 text-center text-sm font-medium text-white shadow-sm"
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
  const { promptAuth } = useAuthPrompt();
  const location = useLocation();
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
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={(e) => {
            if (!user && location.pathname === "/" && it.to !== "/" && it.to !== "/login") {
              e.preventDefault();
              promptAuth({ to: it.to, badge: it.label });
            }
          }}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition ${
              isActive ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-800"
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
  const { promptAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unread = useUnread(user);
  const onboarding = useOnboardingStatus(user);

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

      <header className="glass-strong sticky top-0 z-40 border-b border-slate-200/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
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
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/80 text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-900"
                  aria-label="Notifications"
                >
                  <Icon name="bell" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#1c222c] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <UserMenu user={user} unread={unread} onLogout={handleLogout} onboarding={onboarding} />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-[#1c222c] hover:bg-[#2c3545] px-4 py-2 text-sm font-medium text-white shadow-sm transition"
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

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 sm:px-6">
        <aside className="sticky top-20 my-4 hidden h-[calc(100vh-6rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-3xl glass-sidebar p-2.5 shadow-xl lg:flex border border-white/80">
          <div className="px-3.5 pb-2 pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Campus Marketplace
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">Buy • Sell • Rent • Connect</p>
          </div>

          <div className="hairline mx-2 my-2 h-px" />

          {/* Sidebar Navigation */}
          <div className="thin-scrollbar flex-1 overflow-y-auto">
            <SideNav user={user} />

            {/* Campus Verified Banner in Sidebar */}
            <div className="mx-2 my-3 rounded-2xl border border-slate-200/80 bg-white/60 p-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70">
                  <Icon name="university" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {user?.university_name || "AASTU Campus"}
                  </p>
                  <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Verified Campus
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Card in Sidebar */}
            <div className="mx-2 mb-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick Action
              </p>
              <p className="mt-1 text-xs text-slate-600">Post items to sell or rent to peers</p>
              <Link
                to="/listings/new"
                onClick={(e) => {
                  if (!user && location.pathname === "/") {
                    e.preventDefault();
                    promptAuth({
                      to: "/listings/new",
                      badge: "Create Listing",
                      description:
                        "Log in or sign up with your campus account to list items for sale or rent.",
                    });
                  }
                }}
                className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#1c222c] hover:bg-[#2c3545] px-3 py-2 text-xs font-medium text-white shadow-sm transition"
              >
                <span>Create Listing</span>
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* User profile row at bottom of sidebar */}
          <div className="mt-auto border-t border-slate-200/70 pt-2 px-1">
            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-white/70 transition"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c222c] text-xs font-bold text-white">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xs font-semibold text-slate-800">{user.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{roleLabel(user.role)}</p>
                </div>
              </Link>
            ) : (
              <div className="flex flex-col gap-1 p-1">
                <Link
                  to="/login"
                  className="flex items-center justify-center rounded-xl border border-slate-300/80 bg-white/70 py-1.5 text-xs font-medium text-slate-700 hover:bg-white transition"
                >
                  Log in
                </Link>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-12">
          <div className="mx-auto max-w-7xl py-4 sm:py-6">
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
        onboarding={onboarding}
      />
    </div>
  );
}
