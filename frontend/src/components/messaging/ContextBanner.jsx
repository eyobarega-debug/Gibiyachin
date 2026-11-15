import { Link } from "react-router-dom";
import Icon from "../Icon";

export default function ContextBanner({ type, contextType, contextId, contextData }) {
  if (!contextType && type === "general") return null;

  let title = "Campus Conversation";
  let subtitle = "";
  let linkTo = null;
  let imageUrl = null;
  let tone = "slate";
  let iconName = "messages";

  if (type === "dating" || contextType === "dating_match") {
    title = "Gibiyachin Connect Match ❤️";
    subtitle = "You matched! Say hello and break the ice.";
    linkTo = "/dating";
    tone = "rose";
    iconName = "heart";
  } else if (contextType === "product" || type === "marketplace") {
    title = contextData?.title || "Marketplace Product";
    subtitle = contextData?.price ? `${Number(contextData.price).toLocaleString()} ETB` : "Store Item";
    linkTo = contextId ? `/marketplace/${contextId}` : null;
    imageUrl = contextData?.image || contextData?.imageUrl || null;
    tone = "amber";
    iconName = "marketplace";
  } else if (contextType === "listing") {
    title = contextData?.title || "P2P Student Listing";
    subtitle = contextData?.price ? `${Number(contextData.price).toLocaleString()} ETB` : "Student Listing";
    linkTo = contextId ? `/listings/${contextId}` : null;
    imageUrl = contextData?.image || contextData?.imageUrl || null;
    tone = "indigo";
    iconName = "listings";
  } else if (contextType === "rental" || type === "rental") {
    title = contextData?.title || "Campus Rental Item";
    subtitle = contextData?.dailyRate ? `${Number(contextData.dailyRate).toLocaleString()} ETB / day` : "Rental Item";
    linkTo = contextId ? `/rentals/${contextId}` : null;
    imageUrl = contextData?.image || contextData?.imageUrl || null;
    tone = "blue";
    iconName = "rentals";
  } else if (contextType === "lost_found" || type === "lost_found") {
    const isLost = contextData?.itemType === "lost";
    title = contextData?.title || (isLost ? "Lost Belonging" : "Found Item");
    subtitle = contextData?.category ? `${contextData.category} • ${contextData.campus || "Campus"}` : "Lost & Found";
    linkTo = contextId ? `/lost-found/${contextId}` : null;
    imageUrl = contextData?.image || contextData?.imageUrl || null;
    tone = isLost ? "amber" : "emerald";
    iconName = "lost_found";
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-4 py-2.5 backdrop-blur-xs">
      <div className="flex items-center gap-3 min-w-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-cover border border-slate-200 shadow-xs"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs text-slate-600">
            <Icon name={iconName} className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800">{title}</p>
          <p className="truncate text-[11px] text-slate-500 font-medium">{subtitle}</p>
        </div>
      </div>

      {linkTo && (
        <Link
          to={linkTo}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900"
        >
          View Item
        </Link>
      )}
    </div>
  );
}
