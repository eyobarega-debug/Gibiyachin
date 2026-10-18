import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, LoadingState, PageHeader, Select, Table } from "../../components/ui";
import { ROLE_LABEL, ROLE_TONE, USER_ROLE_FILTERS, fmtDate, humanize } from "./constants";
import UserDetailModal from "./UserDetailModal";
const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
];

export default function SuperAdminUsers() {
  const [users, setUsers] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [campusId, setCampusId] = useState("");
  const [status, setStatus] = useState("");
  const [detailId, setDetailId] = useState(null);

  async function load() {
    setError("");
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (role) params.role = role;
      const headers = campusId ? { "X-University-Id": campusId } : undefined;
      const { data } = await client.get("/admin/users", { params, headers });
      setUsers(data.users || []);
    } catch (err) {
      setError(errMsg(err, "Could not load users"));
      setUsers([]);
    }
  }

  useEffect(() => {
    client
      .get("/super/universities")
      .then(({ data }) => setCampuses(data.universities || []))
      .catch(() => setCampuses([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, campusId]);

  const filtered = (users || []).filter((u) => {
    if (status === "active") return !u.suspended;
    if (status === "suspended") return !!u.suspended;
    if (status === "verified") return !!u.verified;
    if (status === "unverified") return !u.verified;
    return true;
  });

  const campusName = (id) => campuses.find((c) => c.id === id)?.name || (id ? "Assigned" : "—");

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Search, inspect and moderate accounts across the whole platform."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <form
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <Input aria-label="Search users" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
          {USER_ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by campus" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Search</Button>
        </div>
      </form>

      {users === null ? (
        <LoadingState label="Loading users…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="user" title="No users found" subtitle="Adjust your search or filters." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table head={["Name", "Email", "Role", "Campus", "Status", "Joined", ""]}>
              {filtered.map((u) => (
                <tr key={u.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role] || "slate"}>{ROLE_LABEL[u.role] || humanize(u.role)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{campusName(u.university_id)}</td>
                  <td className="px-4 py-3">
                    {u.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="ok">Active</Badge>}
                    {u.verified && <Badge tone="info" className="ml-1">Verified</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{u.name}</p>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                  </div>
                  <Badge tone={ROLE_TONE[u.role] || "slate"}>{ROLE_LABEL[u.role] || humanize(u.role)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="ok">Active</Badge>}
                  {u.verified && <Badge tone="info">Verified</Badge>}
                </div>
                <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => setDetailId(u.id)}>
                  View user
                </Button>
              </Card>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted">Showing up to 100 results (backend limit). Narrow with search or filters.</p>
        </>
      )}

      <UserDetailModal
        open={!!detailId}
        userId={detailId}
        campusId={campusId}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}
