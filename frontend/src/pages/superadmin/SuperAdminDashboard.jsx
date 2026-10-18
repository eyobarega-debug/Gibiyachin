import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client, errMsg } from "../../api/client";
import { Card, ErrorBanner, LoadingState, PageHeader, Table, Badge } from "../../components/ui";
import { StatCard } from "../../components/cards";
import { fmtMoney, ROLE_LABEL } from "./constants";

const ROLE_ORDER = ["student", "merchant", "organizer", "admin", "super_admin"];

export default function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [ov, an, cmp] = await Promise.all([
        client.get("/super/analytics/overview"),
        client.get("/admin/analytics"),
        client.get("/super/analytics/compare"),
      ]);
      setOverview(ov.data);
      setAnalytics(an.data);
      setCampuses(cmp.data.universities || []);
    } catch (err) {
      setError(errMsg(err, "Could not load platform analytics"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !overview) return <LoadingState label="Loading platform analytics…" />;

  const totals = overview?.totals || {};
  const usersByRole = analytics?.usersByRole || {};

  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        subtitle="Aggregated KPIs across every campus. Values come straight from the platform analytics API."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon="university" label="Total Campuses" value={overview?.universityCount ?? "—"} to="/super-admin/campuses" />
        <StatCard icon="checkCircle" label="Active Campuses" value={overview?.activeUniversityCount ?? "—"} />
        <StatCard icon="user" label="Total Users" value={totals.users ?? "—"} to="/super-admin/users" />
        <StatCard icon="store" label="Stores" value={totals.stores ?? "—"} />
        <StatCard icon="orders" label="Total Orders" value={totals.orders ?? "—"} to="/super-admin/orders" />
        <StatCard icon="wallet" label="GMV (completed)" value={fmtMoney(totals.gmv)} />
        <StatCard icon="commission" label="Commission Earned" value={fmtMoney(totals.commission_earned)} />
        <StatCard icon="tickets" label="Tickets Sold" value={totals.tickets_sold ?? "—"} />
        <StatCard icon="events" label="Published Events" value={totals.published_events ?? "—"} />
        <StatCard icon="listings" label="Active Listings" value={totals.active_listings ?? "—"} />
        <StatCard icon="rentals" label="Rental Bookings" value={totals.rental_bookings ?? "—"} />
        <StatCard icon="reports" label="Completed Revenue" value={fmtMoney(analytics?.orders?.completedRevenue)} to="/super-admin/reports" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-ink">Users by role</h2>
          <p className="mt-0.5 text-xs text-muted">Platform-wide breakdown.</p>
          <div className="mt-4 space-y-2">
            {ROLE_ORDER.map((role) => (
              <div key={role} className="flex items-center justify-between gap-3">
                <Badge tone={role === "super_admin" ? "danger" : "slate"}>{ROLE_LABEL[role]}</Badge>
                <span className="text-sm font-semibold text-ink">{usersByRole[role] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-4">
            <div>
              <p className="text-xs text-muted">Active tickets</p>
              <p className="text-lg font-bold text-ink">{analytics?.activeTickets ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Active bookings</p>
              <p className="text-lg font-bold text-ink">{analytics?.activeBookings ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Active listings</p>
              <p className="text-lg font-bold text-ink">{analytics?.activeListings ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Stores</p>
              <p className="text-lg font-bold text-ink">{analytics?.storeCount ?? "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Per-campus comparison</h2>
              <p className="mt-0.5 text-xs text-muted">Key metrics for each university.</p>
            </div>
            <Link to="/super-admin/reports" className="text-xs font-semibold text-slate-700 hover:text-slate-900">
              View reports
            </Link>
          </div>
          {campuses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No campuses yet.</p>
          ) : (
            <Table
              className="rounded-none border-0 shadow-none"
              head={["Campus", "Users", "Stores", "Orders", "GMV", "Commission"]}
            >
              {campuses.map((c) => (
                <tr key={c.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3">{c.users}</td>
                  <td className="px-4 py-3">{c.stores}</td>
                  <td className="px-4 py-3">{c.orders}</td>
                  <td className="px-4 py-3">{fmtMoney(c.gmv)}</td>
                  <td className="px-4 py-3">{fmtMoney(c.commission_earned)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted">
        Some metrics (suspended users, date-ranged trends) are not exposed by the backend APIs and are
        therefore intentionally omitted.
      </p>
    </div>
  );
}
