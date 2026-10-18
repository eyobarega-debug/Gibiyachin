import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, ErrorBanner, Modal, Select, Spinner, SuccessBanner } from "../../components/ui";
import { useConfirm } from "../../components/ConfirmProvider";
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_TONE, fmtDate, humanize } from "./constants";

// Detail + moderation for one platform user. Real endpoints:
//   GET   /api/admin/users/:id
//   PATCH /api/admin/users/:id        ({ role, verified, suspended })
//   POST  /api/super/admins/promote   ({ userId })
export default function UserDetailModal({ open, userId, campusId, onClose, onChanged }) {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = campusId ? { "X-University-Id": campusId } : undefined;

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const { data: res } = await client.get(`/admin/users/${userId}`, { headers });
      setData(res);
    } catch (err) {
      setError(errMsg(err, "Could not load the user"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, campusId]);

  function close() {
    if (busy) return;
    setData(null);
    setError("");
    setSuccess("");
    onClose?.();
  }

  async function patch(body, message) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await client.patch(`/admin/users/${userId}`, body);
      setSuccess(message);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Could not update the user"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    const u = data.user;
    const next = !u.suspended;
    const ok = await confirm({
      title: next ? "Suspend this user?" : "Reactivate this user?",
      message: next
        ? `${u.name} will lose access to CampusHub until reactivated.`
        : `${u.name} will regain access immediately.`,
      confirmLabel: next ? "Suspend" : "Reactivate",
      variant: next ? "danger" : "primary",
    });
    if (!ok) return;
    await patch({ suspended: next }, next ? "User suspended." : "User reactivated.");
  }

  async function promote() {
    const u = data.user;
    if (!u.university_id) {
      setError("This user is not attached to a university, so they cannot be promoted.");
      return;
    }
    const ok = await confirm({
      title: "Promote to campus admin?",
      message: `${u.name} will become a University Administrator.`,
      confirmLabel: "Promote",
      variant: "primary",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await client.post("/super/admins/promote", { userId });
      setSuccess("User promoted to campus admin.");
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, "Could not promote the user"));
    } finally {
      setBusy(false);
    }
  }

  const u = data?.user;

  return (
    <Modal open={open} onClose={close} title={u?.name || "User"} size="lg">
      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !u ? (
        <ErrorBanner message={error || "User not found"} />
      ) : (
        <div className="space-y-5">
          <ErrorBanner message={error} onClose={() => setError("")} />
          <SuccessBanner message={success} onClose={() => setSuccess("")} />

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ROLE_TONE[u.role] || "slate"}>{ROLE_LABEL[u.role] || humanize(u.role)}</Badge>
            {u.verified ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}
            {u.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="ok">Active</Badge>}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Info label="Email" value={u.email} />
            <Info label="Phone" value={u.phone || "—"} />
            <Info label="Campus" value={u.university_name || "—"} />
            <Info label="Verification method" value={humanize(u.verification_method)} />
            <Info label="Joined" value={fmtDate(u.created_at)} />
            <Info label="Activity" value={`${data.activity?.ordersCount ?? 0} orders · ${data.activity?.listingsCount ?? 0} listings`} />
          </dl>

          {data.verificationRequest && (
            <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest verification request</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone="slate">{humanize(data.verificationRequest.document_type)}</Badge>
                <Badge tone={data.verificationRequest.status === "pending" ? "warn" : data.verificationRequest.status === "approved" ? "ok" : "danger"}>
                  {data.verificationRequest.status}
                </Badge>
                <span className="text-xs text-muted">{fmtDate(data.verificationRequest.created_at)}</span>
              </div>
            </div>
          )}

          {u.role === "super_admin" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Super Administrator accounts cannot be modified from this screen.
            </p>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              {u.role === "admin" ? (
                <p className="rounded-lg border border-slate-200 bg-white/70 p-3 text-sm text-slate-700">
                  This is a campus administrator. Promote or demote campus admins from the Campuses page so the
                  “last active admin” safeguard is applied.
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <Select
                      label="Role"
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => patch({ role: e.target.value }, "Role updated.")}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r] || humanize(r)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button variant="outline" onClick={promote} disabled={busy}>
                    Promote to admin
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={u.verified ? "outline" : "success"}
                  disabled={busy}
                  onClick={() => patch({ verified: !u.verified }, u.verified ? "Verification revoked." : "User verified.")}
                >
                  {u.verified ? "Revoke verification" : "Mark verified"}
                </Button>
                <Button variant={u.suspended ? "success" : "danger"} disabled={busy} onClick={toggleSuspend}>
                  {u.suspended ? "Reactivate user" : "Suspend user"}
                </Button>
              </div>
              {u.role !== "admin" && (
                <p className="text-xs text-muted">
                  Promoting to Campus Admin goes through the Super Admin endpoint; the regular role PATCH rejects it.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}
