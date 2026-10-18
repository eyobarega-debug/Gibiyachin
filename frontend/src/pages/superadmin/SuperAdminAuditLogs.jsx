import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, EmptyState, ErrorBanner, Input, LoadingState, PageHeader, Table } from "../../components/ui";
import { fmtDate, shortId } from "./constants";

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState("");
  const [targetType, setTargetType] = useState("");
  const [actorId, setActorId] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});

  async function load() {
    setError("");
    setLogs(null);
    try {
      const params = { page };
      if (targetType.trim()) params.targetType = targetType.trim();
      if (actorId.trim()) params.actorId = actorId.trim();
      const { data } = await client.get("/admin/audit-logs", { params });
      setLogs(data.logs || []);
    } catch (err) {
      setError(errMsg(err, "Could not load audit logs"));
      setLogs([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggle(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const hasNext = (logs?.length || 0) >= 50;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Append-only record of administrative and system actions across the platform."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <form
        className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <Input
          aria-label="Filter by target type"
          placeholder="Target type (e.g. user, university)…"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
        />
        <Input
          aria-label="Filter by actor id"
          placeholder="Actor user ID (UUID)…"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
        />
        <Button type="submit">Filter</Button>
      </form>

      {logs === null ? (
        <LoadingState label="Loading audit logs…" />
      ) : logs.length === 0 ? (
        <EmptyState icon="shield" title="No audit events" subtitle="No log entries match the current filters." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table head={["Time", "Actor", "Action", "Target", "Details"]}>
              {logs.map((l) => (
                <tr key={l.id} className="align-top text-slate-700">
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-4 py-3">
                    {l.actor_name ? (
                      <>
                        <span className="font-medium text-ink">{l.actor_name}</span>
                        <span className="block text-xs text-muted">{l.actor_email}</span>
                      </>
                    ) : (
                      <span className="text-muted">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="slate">{l.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {l.target_type || "—"}
                    {l.target_id ? ` · ${shortId(l.target_id)}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {l.details ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle(l.id)}
                          className="text-xs font-medium text-slate-700 underline decoration-slate-300 hover:text-slate-900"
                        >
                          {expanded[l.id] ? "Hide" : "View"}
                        </button>
                        {expanded[l.id] && (
                          <pre className="mt-2 max-w-xs overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50 p-2 text-[11px] text-slate-700">
                            {JSON.stringify(l.details, null, 2)}
                          </pre>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {logs.map((l) => (
              <div key={l.id} className="glass rounded-2xl border border-white/80 bg-white/75 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone="slate">{l.action}</Badge>
                  <span className="text-xs text-muted">{fmtDate(l.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-ink">{l.actor_name || "System"}</p>
                <p className="text-xs text-muted">
                  {l.target_type || "—"}
                  {l.target_id ? ` · ${shortId(l.target_id)}` : ""}
                </p>
                {l.details && (
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50 p-2 text-[11px] text-slate-700">
                    {JSON.stringify(l.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted">Page {page}</span>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
