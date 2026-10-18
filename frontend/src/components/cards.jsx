import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";
import { Badge } from "./ui";

/* ------------------------------------------------------------------ */
/* Compact glass statistic                                             */
/* ------------------------------------------------------------------ */
export function StatCard({ icon = "sparkles", value, label, className = "" }) {
  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-2 text-muted">
        <Icon name={icon} className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category tile                                                       */
/* ------------------------------------------------------------------ */
export function CategoryCard({ icon = "marketplace", label, to, onClick, className = "" }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-ink">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
      <Icon name="arrowRight" className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </>
  );
  const cls = `glass glass-hover group flex items-center gap-3 rounded-2xl p-4 text-left ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
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
      <div className="flex h-full w-full items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted/80">
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
export function ProductCard({ product, className = "" }) {
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
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-[22px] ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/20" />
        <MediaImage
          src={product.images?.[0]}
          alt={product.title}
          icon="marketplace"
          className="transition duration-500 group-hover:scale-[1.06]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_featured && <Badge tone="accent">Featured</Badge>}
          {out && <Badge tone="danger">Out of stock</Badge>}
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={busy}
          aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 disabled:opacity-60"
        >
          <Icon
            name="favorites"
            className={`h-4 w-4 ${favorited ? "fill-current text-rose-300" : ""}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/6">
            <Icon name="store" className="h-3 w-3" />
          </span>
          <span
            role="link"
            tabIndex={0}
            className="truncate transition hover:text-ink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (product.store_id) navigate(`/seller/${product.store_id}`);
            }}
          >
            {product.store_name || "Campus Store"}
          </span>
          {rating > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-warn">
              · <Icon name="star" className="h-3 w-3" /> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-ink">{product.title}</h3>

        <div className="mt-auto flex items-end justify-between pt-4">
          <span className="text-lg font-bold tracking-tight text-ink">
            {Number(product.price).toFixed(2)}
            <span className="ml-1 text-xs font-medium text-muted">ETB</span>
          </span>
          {!out && <span className="text-xs text-muted">{product.stock} in stock</span>}
        </div>
        <span className="mt-3 flex items-center gap-1 text-sm font-medium text-ink opacity-80 transition group-hover:gap-2 group-hover:opacity-100">
          View Details <Icon name="arrowRight" className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Event card                                                          */
/* ------------------------------------------------------------------ */
export function EventCard({ event, className = "" }) {
  const sold = Number(event.capacity_total) > 0 ? Number(event.capacity_sold) : 0;
  const total = Number(event.capacity_total) || 0;
  const pct = total ? Math.min(100, Math.round((sold / total) * 100)) : 0;

  return (
    <Link
      to={`/events/${event.id}`}
      className={`glass glass-hover group flex h-full flex-col overflow-hidden rounded-2xl ${className}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/25" />
        <MediaImage
          src={event.poster_url}
          alt={event.title}
          icon="events"
          className="transition duration-500 group-hover:scale-[1.06]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        {event.category && (
          <span className="absolute left-3 top-3">
            <Badge tone="slate">{event.category}</Badge>
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-lg border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          {new Date(event.date_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {event.organizer_name || event.club_name}
        </p>
        <h3 className="mt-1 line-clamp-2 font-semibold text-ink">{event.title}</h3>
        <div className="mt-2 space-y-1 text-sm text-muted">
          <p className="flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4" />
            {new Date(event.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-center gap-2">
            <Icon name="mapPin" className="h-4 w-4" />
            <span className="truncate">{event.venue_name || event.location || "TBA"}</span>
          </p>
        </div>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-white/70 to-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{sold}/{total} sold</span>
          </div>
        </div>

        <div className="mt-4">
          <span className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/8 py-2 text-sm font-medium text-ink transition group-hover:bg-white/14">
            Get Ticket <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
