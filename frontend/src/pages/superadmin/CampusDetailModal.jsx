import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Checkbox, ErrorBanner, Input, Modal, Select, Spinner, SuccessBanner } from "../../components/ui";
import { useConfirm } from "../../components/ConfirmProvider";
import { FEATURE_FLAGS, ROLE_LABEL, UNIVERSITY_STATUS_TONE, fmtDate, humanize } from "./constants";

// Detail + management for one tenant. Every action maps to a real endpoint:
//   GET   /api/super/universities/:id
//   PATCH /api/super/universities/:id
//   GET   /api/admin/users            (with X-University-Id header)
//   POST  /api/super/admins/promote
//   POST  /api/super/admins/demote
export default function CampusDetailModal({ open, universityId, onClose, onChanged }) {
  const confirm = useConfirm();
  const [detail, setDetail] = useState(null);
  const [campusUsers, setCampusUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoteId, setPromoteId] = useState("");

  const [edit, setEdit] = useState({ name: "", domain: "", permittedDomains: "" });

  async function load() {
    if (!universityId) return;
    setLoading(true);
    setError("");
    try {
      const [uniRes, usersRes] = await Promise.all([
        client.get(`/super/universities/${universityId}`),
        client.get("/admin/users", { headers: { "X-University-Id": universityId } }),
      ]);
      const uni = uniRes.data.university;
      setDetail({ university: uni, admins: uniRes.data.admins || [] });
      setCampusUsers(usersRes.data.users || []);
      setEdit({
        name: uni.name || "",
        domain: uni.domain || "",
        permittedDomains: (uni.permitted_domains || []).join(", "),
      });
    } catch (err) {
      setError(errMsg(err, "Could not load campus details"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && universityId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, universityId]);

  function close() {
    if (busy) return;
    setDetail(null);
    setCampusUsers([]);
    setError("");
    setSuccess("");
    onClose?.();
  }

  async function patchCampus(body, message) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await client.patch(`/super/universities/${universityId}`, body);
      setSuccess(message);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Could not update the campus"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBasics(e) {
    e.preventDefault();
    const domains = edit.permittedDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    await patchCampus(
      { name: edit.name.trim(), domain: edit.domain.trim() || null, permittedDomains: domains },
      "Campus details saved."
    );
  }

  async function toggleStatus() {
    const next = detail.university.status === "active" ? "suspended" : "active";
    const ok = await confirm({
      title: next === "suspended" ? "Suspend campus?" : "Activate campus?",
      message:
        next === "suspended"
          ? "Students and staff of this campus will lose access until it is reactivated."
          : "Access will be restored for this campus.",
      confirmLabel: next === "suspended" ? "Suspend" : "Activate",
      variant: next === "suspended" ? "danger" : "primary",
    });
    if (!ok) return;
    await patchCampus({ status: next }, `Campus ${next}.`);
  }

  async function saveFlags() {
    const flags = {};
    for (const f of FEATURE_FLAGS) {
      flags[f.key] = !!detail.university.feature_flags?.[f.key];
    }
    await patchCampus({ featureFlags: flags }, "Feature flags saved.");
  }

  function toggleFlag(key, checked) {
    setDetail((d) => ({
      ...d,
      university: { ...d.university, feature_flags: { ...(d.university.feature_flags || {}), [key]: checked } },
    }));
  }

  async function demote(admin) {
    const ok = await confirm({
      title: "Demote administrator?",
      message: `${admin.name} will be returned to the student role. The backend refuses to demote a campus's only active admin.`,
      confirmLabel: "Demote",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await client.post("/super/admins/demote", { userId: admin.id });
      setSuccess(`${admin.name} demoted.`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Could not demote the administrator"));
    } finally {
      setBusy(false);
    }
  }

  async function promote() {
    if (!promoteId) return;
    const user = campusUsers.find((u) => u.id === promoteId);
    const ok = await confirm({
      title: "Promote to campus admin?",
      message: `${user?.name || "This user"} will become a University Administrator for this campus.`,
      confirmLabel: "Promote",
      variant: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await client.post("/super/admins/promote", { userId: promoteId });
      setSuccess("User promoted to campus admin.");
      setPromoteId("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Could not promote the user"));
    } finally {
      setBusy(false);
    }
  }

  const candidates = campusUsers.filter((u) => !["admin", "super_admin"].includes(u.role));
  const uni = detail?.university;

  return (
    <Modal open={open} onClose={close} title={uni?.name || "Campus"} size="xl">
      {loading && !detail ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <ErrorBanner message={error} onClose={() => setError("")} />
          <SuccessBanner message={success} onClose={() => setSuccess("")} />

          {uni && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={UNIVERSITY_STATUS_TONE[uni.status] || "slate"}>{uni.status || "unknown"}</Badge>
                <Badge tone="slate">{uni.isolation_mode || "shared"} isolation</Badge>
                <span className="text-xs text-muted">Created {fmtDate(uni.created_at)}</span>
              </div>

              <form onSubmit={saveBasics} className="grid gap-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 sm:grid-cols-2">
                <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <Input label="Domain" value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value })} placeholder="campus.edu.et" />
                <Input
                  label="Permitted domains"
                  className="sm:col-span-2"
                  value={edit.permittedDomains}
                  onChange={(e) => setEdit({ ...edit, permittedDomains: e.target.value })}
                  hint="Comma separated. Emails from these domains can auto-verify."
                />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" loading={busy}>
                    Save details
                  </Button>
                  <Button type="button" variant={uni.status === "active" ? "danger" : "success"} onClick={toggleStatus} disabled={busy}>
                    {uni.status === "active" ? "Suspend campus" : "Activate campus"}
                  </Button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Feature flags</p>
                    <p className="text-xs text-muted">Disable modules for this campus.</p>
                  </div>
                  <Button size="sm" onClick={saveFlags} disabled={busy}>
                    Save flags
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {FEATURE_FLAGS.map((f) => (
                    <Checkbox
                      key={f.key}
                      label={f.label}
                      checked={!!uni.feature_flags?.[f.key]}
                      onChange={(e) => toggleFlag(f.key, e.target.checked)}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                <p className="text-sm font-semibold text-ink">Campus administrators</p>
                {detail.admins.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No administrators assigned.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.admins.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                          <p className="truncate text-xs text-muted">{a.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.suspended && <Badge tone="danger">Suspended</Badge>}
                          <Button size="sm" variant="danger" onClick={() => demote(a)} disabled={busy}>
                            Demote
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200/80 pt-4">
                  <div className="min-w-[200px] flex-1">
                    <Select label="Promote a user" value={promoteId} onChange={(e) => setPromoteId(e.target.value)}>
                      <option value="">Select a user…</option>
                      {candidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {ROLE_LABEL[u.role] || humanize(u.role)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button onClick={promote} disabled={!promoteId || busy}>
                    Promote
                  </Button>
                </div>
                {candidates.length === 0 && (
                  <p className="mt-2 text-xs text-muted">No eligible users on this campus to promote.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
