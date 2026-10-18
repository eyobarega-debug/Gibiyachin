import { useEffect, useMemo, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, LoadingState, PageHeader, Select, Table } from "../../components/ui";
import { UNIVERSITY_STATUS_TONE } from "./constants";
import CampusCreateModal from "./CampusCreateModal";
import CampusDetailModal from "./CampusDetailModal";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

export default function SuperAdminCampuses() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  async function load() {
    setError("");
    try {
      const { data } = await client.get("/super/universities");
      setList(data.universities || []);
    } catch (err) {
      setError(errMsg(err, "Could not load campuses"));
      setList([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list || []).filter((u) => {
      if (status && u.status !== status) return false;
      if (!q) return true;
      return [u.name, u.code, u.city, u.region, u.slug, u.domain]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [list, search, status]);

  return (
    <div>
      <PageHeader
        title="Campuses / Tenants"
        subtitle="Onboard universities, manage their status, features and administrators."
        action={<Button onClick={() => setCreateOpen(true)}>New campus</Button>}
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          aria-label="Search campuses"
          placeholder="Search by name, code, location or domain…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {list === null ? (
        <LoadingState label="Loading campuses…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="university"
          title={list.length === 0 ? "No campuses yet" : "No campuses match your filters"}
          subtitle={list.length === 0 ? "Onboard the first university to get started." : "Try a different search or status."}
          action={list.length === 0 ? <Button onClick={() => setCreateOpen(true)}>Onboard a campus</Button> : null}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table head={["Campus", "Code", "Location", "Domain", "Status", "Users", "Admins", ""]}>
              {filtered.map((u) => (
                <tr key={u.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{u.code || u.slug || "—"}</td>
                  <td className="px-4 py-3 text-muted">{[u.city, u.region].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-muted">{u.domain || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={UNIVERSITY_STATUS_TONE[u.status] || "slate"}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{u.user_count ?? 0}</td>
                  <td className="px-4 py-3">{u.admin_count ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)}>
                      Manage
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
                    <p className="truncate text-xs text-muted">
                      {[u.code, [u.city, u.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || u.domain || "No domain"}
                    </p>
                  </div>
                  <Badge tone={UNIVERSITY_STATUS_TONE[u.status] || "slate"}>{u.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                  <span>{u.user_count ?? 0} users</span>
                  <span>{u.admin_count ?? 0} admins</span>
                </div>
                <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => setDetailId(u.id)}>
                  Manage campus
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <CampusCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(uni) => {
          setCreateOpen(false);
          load();
          if (uni?.id) setDetailId(uni.id);
        }}
      />
      <CampusDetailModal
        open={!!detailId}
        universityId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}
