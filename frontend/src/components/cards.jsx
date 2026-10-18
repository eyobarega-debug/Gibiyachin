import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";
import { Badge } from "./ui";

/* ------------------------------------------------------------------ */
/* Compact glass statistic                                             */
/* ------------------------------------------------------------------ */
export function StatCard({ icon = "sparkles", value, label, to, onClick, className = "" }) {
  const content = (
    <div
      className={`glass glass-hover group flex flex-col justify-between rounded-2xl border border-white/80 bg-white/75 p-4.5 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        </div>
        {to && (
          <span className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400 transition group-hover:text-slate-800">
            View all <Icon name="arrowRight" className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* Category tile                                                       */
/* ------------------------------------------------------------------ */
export function CategoryCard({ icon = "marketplace", label, to, onClick, className = "" }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 shadow-xs">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>
      <Icon name="arrowRight" className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-800" />
    </>
  );
  const cls = `glass glass-hover group flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 text-left shadow-xs transition hover:bg-white/95 ${className}`;
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Image with graceful fallback                                        */
/* ------------------------------------------------------------------ */
export function MediaImage({ src, alt, icon = "image", className = "" }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100/70">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 text-slate-400">
          <Icon name={icon} className="h-6 w-6" />
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Product card                                                        */
/* ------------------------------------------------------------------ */
export function ProductCard({ product, onClick, className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      if (favorited) {
        await client.delete(`/products/${product.id}/favorite`);
        setFavorited(false);
      } else {
        await client.post(`/products/${product.id}/favorite`);
        setFavorited(true);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const out = product.status === "out_of_stock";
  const rating = Number(product.avg_rating) || 0;

  return (
    <Link
      to={`/marketplace/${product.id}`}
      onClick={onClick}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white/75 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <MediaImage
          src={product.images?.[0]}
          alt={product.title}
          icon="marketplace"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-900/30 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_featured && <Badge tone="accent">Featured</Badge>}
          {out && <Badge tone="danger">Out of stock</Badge>}
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={busy}
          aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/90 bg-white/80 text-slate-700 shadow-xs backdrop-blur-md transition hover:bg-white hover:text-rose-500 disabled:opacity-60"
        >
          <Icon
            name="favorites"
            className={`h-4 w-4 ${favorited ? "fill-current text-rose-500" : ""}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50">
            <Icon name="store" className="h-3 w-3 text-slate-600" />
          </span>
          <span
            role="link"
            tabIndex={0}
            className="truncate transition hover:text-slate-900"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (product.store_id) navigate(`/seller/${product.store_id}`);
            }}
          >
            {product.store_name || "Campus Store"}
          </span>
          {rating > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-amber-500 font-semibold">
              · <Icon name="star" className="h-3 w-3 fill-current" /> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-slate-900">{product.title}</h3>

        <div className="mt-auto flex items-end justify-between pt-4">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            {Number(product.price).toFixed(2)}
            <span className="ml-1 text-xs font-medium text-slate-500">ETB</span>
          </span>
          {!out && <span className="text-xs text-slate-500">{product.stock} in stock</span>}
        </div>
        <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700 opacity-80 transition group-hover:gap-1.5 group-hover:opacity-100 group-hover:text-slate-900">
          View Details <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Event card                                                          */
/* ------------------------------------------------------------------ */
export function EventCard({ event, onClick, className = "" }) {
  const sold = Number(event.capacity_total) > 0 ? Number(event.capacity_sold) : 0;
  const total = Number(event.capacity_total) || 0;
  const pct = total ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const dateObj = new Date(event.date_time);
  const monthStr = dateObj.toLocaleDateString(undefined, { month: "short" });
  const dayStr = dateObj.toLocaleDateString(undefined, { day: "numeric" });

  return (
    <Link
      to={`/events/${event.id}`}
      onClick={onClick}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/75 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        <MediaImage
          src={event.poster_url}
          alt={event.title}
          icon="events"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/40 to-transparent" />
        {event.category && (
          <span className="absolute left-3 top-3">
            <Badge tone="slate">{event.category}</Badge>
          </span>
        )}
        <div className="absolute bottom-3 left-3 rounded-xl border border-white/90 bg-white/90 px-3 py-1 text-center shadow-sm backdrop-blur-md">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{monthStr}</span>
          <span className="block text-sm font-extrabold text-slate-900 leading-none">{dayStr}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {event.organizer_name || event.club_name}
        </p>
        <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">{event.title}</h3>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
            {dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-center gap-1.5">
            <Icon name="mapPin" className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{event.venue_name || event.location || "Campus Venue"}</span>
          </p>
        </div>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/70">
            <div className="h-full rounded-full bg-[#1c222c]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>{sold}/{total} sold</span>
            <span className="font-medium text-slate-700">{pct}%</span>
          </div>
        </div>

        <div className="mt-4">
          <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1c222c] hover:bg-[#2c3545] py-2 text-xs font-semibold text-white shadow-xs transition">
            Get Ticket <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Rental card                                                         */
/* ------------------------------------------------------------------ */
export function RentalCard({ rental, onClick, className = "" }) {
  return (
    <Link
      to={`/rentals/${rental.id}`}
      onClick={onClick}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white/75 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <MediaImage
          src={rental.images?.[0]}
          alt={rental.title}
          icon="rentals"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-900/35 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-xl border border-white/90 bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-md">
          {Number(rental.price_per_day).toFixed(2)} ETB <span className="font-normal text-[10px] text-slate-500">/ day</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900">{rental.title}</h3>
        <p className="mt-1 text-xs text-slate-500">by {rental.owner_name}</p>
        <div className="mt-auto flex items-end justify-between pt-4 text-xs">
          <span className="text-slate-500">deposit: <strong className="text-slate-700 font-semibold">{Number(rental.deposit).toFixed(0)} ETB</strong></span>
          <span className="flex items-center gap-1 font-semibold text-slate-800 transition group-hover:gap-1.5">
            Rent <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* P2P Listing card                                                    */
/* ------------------------------------------------------------------ */
export function ListingCard({ listing, onClick, className = "" }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      onClick={onClick}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white/75 shadow-xs transition hover:bg-white/95 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <MediaImage
          src={listing.images?.[0]}
          alt={listing.title}
          icon="listings"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-900/35 to-transparent" />
        {listing.condition && (
          <span className="absolute bottom-3 left-3 rounded-xl border border-white/90 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-md">
            {listing.condition}
          </span>
        )}
        {listing.status === "pending_review" && (
          <span className="absolute right-3 top-3">
            <Badge tone="warn">Under review</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900">{listing.title}</h3>
        <p className="mt-1 text-xs text-slate-500">by {listing.seller_name}</p>
        <div className="mt-auto flex items-end justify-between pt-4">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            {Number(listing.price).toFixed(2)}
            <span className="ml-1 text-xs font-medium text-slate-500">ETB</span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-800 transition group-hover:gap-1.5">
            View <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
