import { Card } from "../ui";
import Icon from "../Icon";

export default function ProfileStats({ stats, role = "student" }) {
  if (!stats) return null;

  if (role === "student") {
    const items = [
      { label: "Orders Placed", value: stats.ordersCount || 0, icon: "marketplace" },
      { label: "Rental Bookings", value: stats.bookingsCount || 0, icon: "refresh" },
      { label: "P2P Listings", value: stats.listingsCount || 0, icon: "listings" },
      { label: "Event Tickets", value: stats.ticketsCount || 0, icon: "tickets" },
      { label: "Saved Favorites", value: stats.favoritesCount || 0, icon: "favorites" },
      { label: "Reviews Given", value: stats.reviewsGiven || 0, icon: "star" },
    ];

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <Card key={it.label} className="p-4 text-center transition hover:border-white/20">
            <Icon name={it.icon} className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-1 text-2xl font-bold text-ink">{it.value}</p>
            <p className="text-xs font-medium text-muted">{it.label}</p>
          </Card>
        ))}
      </div>
    );
  }

  if (role === "merchant") {
    const items = [
      { label: "Active Products", value: `${stats.activeProducts || 0} / ${stats.totalProducts || 0}`, icon: "products" },
      { label: "Total Orders", value: stats.totalOrders || 0, icon: "orders" },
      { label: "Completed Orders", value: stats.completedOrders || 0, icon: "checkCircle" },
      {
        label: "Total Revenue",
        value: `${Number(stats.totalRevenue || 0).toFixed(2)} ETB`,
        icon: "sales",
      },
      {
        label: "Seller Rating",
        value: stats.ratingCount > 0 ? `${stats.averageRating} (${stats.ratingCount})` : "New Seller",
        icon: "star",
      },
      {
        label: "Store Status",
        value: stats.hasStore ? (stats.storeStatus || "Active") : "No Store",
        icon: "store",
      },
    ];

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <Card key={it.label} className="p-4 text-center transition hover:border-white/20">
            <Icon name={it.icon} className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-1 text-xl font-bold text-ink">{it.value}</p>
            <p className="text-xs font-medium text-muted">{it.label}</p>
          </Card>
        ))}
      </div>
    );
  }

  if (role === "organizer") {
    const items = [
      { label: "Events Created", value: stats.totalEvents || 0, icon: "calendar" },
      { label: "Upcoming Events", value: stats.upcomingEvents || 0, icon: "clock" },
      { label: "Completed Events", value: stats.completedEvents || 0, icon: "trophy" },
      { label: "Tickets Sold", value: stats.ticketsSold || 0, icon: "tickets" },
      { label: "Total Attendees", value: stats.totalAttendees || 0, icon: "attendees" },
      { label: "Club Status", value: stats.hasClub ? (stats.clubStatus || "Active") : "No Club", icon: "university" },
    ];

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <Card key={it.label} className="p-4 text-center transition hover:border-white/20">
            <Icon name={it.icon} className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-1 text-2xl font-bold text-ink">{it.value}</p>
            <p className="text-xs font-medium text-muted">{it.label}</p>
          </Card>
        ))}
      </div>
    );
  }

  if (role === "admin" || role === "super_admin") {
    const items = [
      { label: "Users Managed", value: stats.usersManaged || 0, icon: "attendees" },
      { label: "Active Stores", value: stats.merchantsCount || 0, icon: "store" },
      { label: "Active Clubs", value: stats.clubsCount || 0, icon: "university" },
      { label: "Open Reports", value: stats.openReports || 0, icon: "alert" },
      { label: "Platform Orders", value: stats.totalOrders || 0, icon: "marketplace" },
      {
        label: "Platform Revenue",
        value: `${Number(stats.platformRevenue || 0).toFixed(2)} ETB`,
        icon: "sales",
      },
    ];

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <Card key={it.label} className="p-4 text-center transition hover:border-white/20">
            <Icon name={it.icon} className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-1 text-xl font-bold text-ink">{it.value}</p>
            <p className="text-xs font-medium text-muted">{it.label}</p>
          </Card>
        ))}
      </div>
    );
  }

  return null;
}
