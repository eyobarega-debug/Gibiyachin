import { NavLink } from "react-router-dom";
import Icon from "../Icon";

export default function DatingNav({ activeMatchesCount = 0 }) {
  const links = [
    { to: "/dating", label: "Discover", icon: "compass", end: true },
    { to: "/dating/matches", label: "Matches", icon: "heart", badge: activeMatchesCount },
    { to: "/dating/profile", label: "My Profile", icon: "user" },
    { to: "/dating/settings", label: "Preferences", icon: "filter" },
  ];

  return (
    <div className="mb-6 flex items-center justify-between border-b border-slate-200/80 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
          <Icon name="heart" className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Gibiyachin Connect <span className="text-rose-500 text-sm">❤️</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Campus Dating &amp; Mutual Matching
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-xs">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            <Icon name={link.icon} className="h-4 w-4" />
            <span className="hidden sm:inline">{link.label}</span>
            {link.badge > 0 && (
              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
