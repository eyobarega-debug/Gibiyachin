import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  SuccessBanner,
  Table,
  TextArea,
} from "../../components/ui";
import { useConfirm } from "../../components/ConfirmProvider";
import { fmtDate } from "./constants";

// Super Admin → Campus Admins (Phases 4/7/18/19).
// Real endpoints:
//   GET   /api/super/admins
//   POST  /api/super/admins                ({ name, email, password, universityId, phone? })
//   PATCH /api/super/admins/:id            ({ universityId?, suspended?, reason? })
//   POST  /api/super/admins/promote        ({ userId })  — promote existing user
export default function SuperAdminAdmins() {
  const [admins, setAdmins] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);

  async function load() {
    setError("");
    try {
      const { data } = await client.get("/super/admins");
      setAdmins(data.admins || []);
    } catch (err) {
      setError(errMsg(err, "Could not load campus admins"));
      setAdmins([]);
    }
  }

  useEffect(() => {
    load();
    client
      .get("/super/universities")
      .then(({ data }) => setCampuses(data.universities || []))
      .catch(() => setCampuses([]));
  }, []);

  const campusName = (id) => campuses.find((c) => c.id === id)?.name || "—";

  return (
    <div>
      <PageHeader
        title="Campus Admins"
        subtitle="Create and manage the administrator of each campus. Every admin belongs to exactly one campus."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />
      <SuccessBanner message={success} onClose={() => setSuccess("")} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Admins can only manage users, merchants and organizers of their own campus. Platform settings,
          commissions and terms stay with the Super Admin.
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          Add Campus Admin
        </Button>
      </div>

      {admins === null ? (
        <LoadingState label="Loading admins…" />
      ) : admins.length === 0 ? (
        <EmptyState icon="user" title="No campus admins" subtitle="Create the first one with “Add Campus Admin”." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table head={["Name", "Email", "Campus", "Status", "Created", "Actions"]}>
              {admins.map((a) => (
                <tr key={a.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-ink">{a.name}</td>
                  <td className="px-4 py-3 text-muted">{a.email}</td>
                  <td className="px-4 py-3 text-muted">{a.university_name || campusName(a.university_id)}</td>
                  <td className="px-4 py-3">
                    {a.suspended ? <Badge tone="danger">Deactivated</Badge> : <Badge tone="ok">Active</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(a.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(a)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {admins.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{a.name}</p>
                    <p className="truncate text-xs text-muted">{a.email}</p>
                    <p className="mt-1 text-xs text-muted">{a.university_name || campusName(a.university_id)}</p>
                  </div>
                  {a.suspended ? <Badge tone="danger">Deactivated</Badge> : <Badge tone="ok">Active</Badge>}
                </div>
                <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => setDetail(a)}>
                  Manage
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <CreateAdminModal
        open={creating}
        campuses={campuses}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          setSuccess("Campus admin created.");
          load();
        }}
      />

      <AdminDetailModal
        admin={detail}
        campuses={campuses}
        onClose={() => setDetail(null)}
        onChanged={(msg) => {
          setDetail(null);
          setSuccess(msg);
          load();
        }}
      />
    </div>
  );
}

function CreateAdminModal({ open, campuses, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", universityId: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", password: "", universityId: "", phone: "" });
      setError("");
    }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await client.post("/super/admins", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        universityId: form.universityId,
        phone: form.phone.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(errMsg(err, "Could not create the admin"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Campus Admin" size="md">
      <form onSubmit={submit} className="space-y-3">
        <ErrorBanner message={error} onClose={() => setError("")} />
        <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs text-slate-600">
          The admin will be able to sign in immediately with the email and password below and will only
          manage users of the selected campus. A campus is required — there is no "all campuses" admin role.
        </p>
        <Input
          label="Full name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          required
          minLength={8}
          hint="Minimum 8 characters."
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Select
          label="Campus"
          required
          value={form.universityId}
          onChange={(e) => setForm({ ...form, universityId: e.target.value })}
        >
          <option value="">Select campus…</option>
          {campuses
            .filter((c) => c.status === "active")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Input
          label="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" loading={busy}>
            Create Admin
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AdminDetailModal({ admin, campuses, onClose, onChanged }) {
  const confirm = useConfirm();
  const [campusId, setCampusId] = useState("");
  const [reason, setReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (admin) {
      setCampusId(admin.university_id || "");
      setReason("");
      setDeactivating(false);
      setError("");
    }
  }, [admin]);

  if (!admin) return null;

  async function saveCampus() {
    if (!campusId || campusId === admin.university_id) return;
    setBusy(true);
    setError("");
    try {
      await client.patch(`/super/admins/${admin.id}`, { universityId: campusId });
      onChanged(`${admin.name}'s campus changed.`);
    } catch (err) {
      setError(errMsg(err, "Could not change the campus"));
    } finally {
      setBusy(false);
    }
  }

  async function setSuspended(next) {
    setBusy(true);
    setError("");
    try {
      await client.patch(`/super/admins/${admin.id}`, {
        suspended: next,
        reason: reason.trim() || undefined,
      });
      onChanged(next ? `${admin.name} deactivated.` : `${admin.name} reactivated.`);
    } catch (err) {
      setError(errMsg(err, "Could not update the admin"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    if (!admin.suspended) {
      const ok = await confirm({
        title: "Deactivate this admin?",
        message: `${admin.name} will lose access to the Admin dashboard and will no longer be able to manage users or approve applications. Audit history is kept.`,
        confirmLabel: "Continue",
        variant: "danger",
      });
      if (!ok) return;
      setDeactivating(true);
      return;
    }
    const ok = await confirm({
      title: "Reactivate this admin?",
      message: `${admin.name} will regain access to their campus console.`,
      confirmLabel: "Reactivate",
      variant: "primary",
    });
    if (ok) setSuspended(false);
  }

  const campusChanged = campusId && campusId !== admin.university_id;

  return (
    <Modal open={!!admin} onClose={onClose} title={admin.name} size="md">
      <div className="space-y-5">
        <ErrorBanner message={error} onClose={() => setError("")} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warn">Campus Admin</Badge>
          {admin.suspended ? <Badge tone="danger">Deactivated</Badge> : <Badge tone="ok">Active</Badge>}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{admin.email}</dd>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{admin.phone || "—"}</dd>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current campus</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{admin.university_name || "—"}</dd>
          </div>
          <div className="rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Created</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{fmtDate(admin.created_at)}</dd>
          </div>
        </dl>

        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
          <h4 className="text-sm font-semibold text-ink">Change campus</h4>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Campus"
              value={campusId}
              disabled={busy}
              onChange={(e) => setCampusId(e.target.value)}
              className="max-w-[260px] flex-1"
            >
              {campuses
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Button variant="outline" disabled={busy || !campusChanged} onClick={saveCampus}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted">
            The admin immediately gains access to the new campus's users, merchants, organizers and
            applications, and loses access to the previous one.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
          <h4 className="text-sm font-semibold text-ink">
            {admin.suspended ? "Reactivate account" : "Deactivate account"}
          </h4>
          {deactivating ? (
            <>
              <TextArea
                label="Reason (optional)"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" disabled={busy} onClick={() => setSuspended(true)}>
                  {busy ? "Saving…" : "Confirm deactivation"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setDeactivating(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button variant={admin.suspended ? "success" : "danger"} disabled={busy} onClick={toggleSuspend}>
              {admin.suspended ? "Reactivate admin" : "Deactivate admin"}
            </Button>
          )}
          <p className="text-xs text-muted">
            A deactivated admin cannot sign in or perform any administrative action. Their audit history is
            preserved. The last active admin of a campus cannot be deactivated.
          </p>
        </div>
      </div>
    </Modal>
  );
}
