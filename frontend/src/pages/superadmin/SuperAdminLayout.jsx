import { NavLink, Outlet } from "react-router-dom";
import Icon from "../../components/Icon";

const NAV = [
  { to: "/super-admin", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/super-admin/applications", label: "Applications", icon: "file" },
  { to: "/super-admin/campuses", label: "Campuses", icon: "university" },
  { to: "/super-admin/admins", label: "Campus Admins", icon: "shield" },
  { to: "/super-admin/users", label: "Users", icon: "user" },
  { to: "/super-admin/verifications", label: "Verifications", icon: "verification" },
  { to: "/super-admin/orders", label: "Orders & Payments", icon: "orders" },
  { to: "/super-admin/reports", label: "Reports", icon: "reports" },
  { to: "/super-admin/audit-logs", label: "Audit Logs", icon: "shield" },
  { to: "/super-admin/settings", label: "Settings", icon: "key" },
];

// Dedicated shell for the platform-level console. It reuses the app's global
// header/sidebar and only adds a section header + sub-navigation so the visual
// language stays identical to the rest of CampusHub.
export default function SuperAdminLayout() {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-white/90 text-slate-900 shadow-sm">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">Super Admin Console</h1>
          <p className="text-sm text-muted">Platform-wide oversight across every campus.</p>
        </div>
      </div>

      <nav
        aria-label="Super admin sections"
        className="thin-scrollbar mb-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-200/40 p-1.5"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition duration-200 ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm font-semibold"
                  : "text-muted hover:bg-white/60 hover:text-ink"
              }`
            }
          >
            <Icon name={n.icon} className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
