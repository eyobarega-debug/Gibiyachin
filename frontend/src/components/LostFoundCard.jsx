import { Link } from "react-router-dom";
import Icon from "./Icon";
import { Badge } from "./ui";
import { MediaImage } from "./cards";

export default function LostFoundCard({ item, onClick, className = "" }) {
  const isLost = item.type === "lost" || item.report_type === "lost" || item.reportType === "lost";
  const dateVal = item.date_incident || item.date || item.created_at;
  const formattedDate = dateVal
    ? new Date(dateVal).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Status tones
  const statusTones = {
    open: "info",
    matched: "accent",
    claim_pending: "warn",
    awaiting_handover: "accent",
    returned: "ok",
    closed: "slate",
    expired: "slate",
    removed: "danger",
  };

  const statusLabels = {
    open: "Open",
    matched: "Match Found",
    claim_pending: "Claim Pending",
    awaiting_handover: "Awaiting Handover",
    returned: "Returned & Recovered",
    closed: "Closed",
    expired: "Expired",
    removed: "Removed",
  };

  const primaryImage =
    (Array.isArray(item.images) && item.images[0]) ||
    item.image ||
    null;

  return (
    <Link
      to={`/lost-found/${item.id}`}
      onClick={onClick}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white/75 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <MediaImage
          src={primaryImage}
          alt={item.title}
          icon="lost_found"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-900/35 to-transparent" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${
              isLost
                ? "border border-amber-300 bg-amber-500/90 text-white"
                : "border border-emerald-300 bg-emerald-600/90 text-white"
            }`}
          >
            {isLost ? "Lost" : "Found"}
          </span>

          {item.status && item.status !== "open" && (
            <Badge tone={statusTones[item.status] || "slate"}>
              {statusLabels[item.status] || item.status}
            </Badge>
          )}
        </div>

        {/* Reward Badge */}
        {Number(item.reward_amount) > 0 && (
          <span className="absolute bottom-3 right-3 rounded-xl border border-white/90 bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm backdrop-blur-md">
            {Number(item.reward_amount).toFixed(0)} ETB Reward
          </span>
        )}

        {/* Category Pill */}
        {item.category && (
          <span className="absolute bottom-3 left-3 rounded-xl border border-white/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-md">
            {item.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-ink">
          {item.title}
        </h3>

        {/* Location & Incident Date */}
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          {item.location && (
            <div className="flex items-center gap-1.5 truncate">
              <Icon name="mapPin" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{item.location}</span>
            </div>
          )}

          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Icon name="calendar" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{isLost ? "Lost around: " : "Found around: "}{formattedDate}</span>
            </div>
          )}
        </div>

        {/* Action Link Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-slate-200/60 pt-3">
          <span className="text-[11px] font-medium text-slate-400">
            {item.reporter_name ? `Reported by ${item.reporter_name}` : "Campus Report"}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-800 transition group-hover:gap-1.5">
            View Details <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
