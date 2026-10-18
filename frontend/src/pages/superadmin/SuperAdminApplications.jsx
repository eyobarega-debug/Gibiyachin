import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Card, ErrorBanner, LoadingState, PageHeader, Select, SuccessBanner, Table, TextArea } from "../../components/ui";
import { useConfirm } from "../../components/ConfirmProvider";
import { fmtDate } from "./constants";

const KINDS = [
  { id: "merchant", label: "Merchant", listUrl: "/merchants/applications", decideUrl: (id) => `/merchants/${id}/decision`, nameOf: (a) => a.business_name },
  { id: "organizer", label: "Organizer", listUrl: "/organizers/applications", decideUrl: (id) => `/organizers/applications/${id}/decision`, nameOf: (a) => a.organizer_name },
];

const STATUS_TONES = { pending_review: "warn", approved: "ok", rejected: "danger" };
const STATUS_LABELS = { pending_review: "Pending", approved: "Approved", rejected: "Rejected" };

export default function SuperAdminApplications() {
  const confirm = useConfirm();
  const [kindId, setKindId] = useState("merchant");
  const kind = KINDS.find((k) => k.id === kindId);
  const [apps, setApps] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [status, setStatus] = useState("pending_review");
  const [universityId, setUniversityId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setError("");
    setApps(null);
    try {
      const params = { status };
      if (universityId) params.universityId = universityId;
      const { data } = await client.get(kind.listUrl, { params });
      setApps(data.applications || []);
    } catch (err) {
      setError(errMsg(err, "Could not load applications"));
      setApps([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindId, status, universityId]);

  useEffect(() => {
    client
      .get("/super/universities")
      .then(({ data }) => setCampuses(data.universities || []))
      .catch(() => setCampuses([]));
  }, []);

  async function decide(app, decision) {
    if (decision === "reject") {
      setRejectingId(app.id);
      setRejectReason("");
      return;
    }
    const ok = await confirm({
      title: "Approve application",
      message: `Approve "${kind.nameOf(app)}"? This grants the ${kind.label.toLowerCase()} capability.`,
      confirmLabel: "Approve",
      variant: "primary",
    });
    if (!ok) return;
    setBusyId(app.id);
    setError("");
    setSuccess("");
    try {
      await client.patch(kind.decideUrl(app.id), { decision: "approve" });
      setSuccess("Application approved.");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not record decision"));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject(app) {
    if (rejectReason.trim().length < 2) return;
    setBusyId(app.id);
    setError("");
    setSuccess("");
    try {
      await client.patch(kind.decideUrl(app.id), { decision: "reject", reason: rejectReason.trim() });
      setSuccess("Application rejected.");
      setRejectingId(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not record decision"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Onboarding Applications"
        subtitle="Merchant and organizer applications across every campus."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />
      <SuccessBanner message={success} onClose={() => setSuccess("")} />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-200/40 p-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKindId(k.id)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                kindId === k.id ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-muted hover:bg-white/60 hover:text-ink"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </Select>
        <Select label="Campus" value={universityId} onChange={(e) => setUniversityId(e.target.value)} className="max-w-[240px]">
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {apps === null ? (
        <LoadingState label="Loading applications…" />
      ) : apps.length === 0 ? (
        <p className="text-sm text-muted">No {kind.label.toLowerCase()} applications match this filter.</p>
      ) : (
        <Table head={["Applicant", kind.id === "merchant" ? "Business" : "Organizer", "Campus", "Status", "Submitted", "Terms", "Actions"]}>
          {apps.map((a) => (
            <tr key={a.id} className="text-slate-700">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{a.applicant_name}</p>
                <p className="text-xs text-muted">{a.applicant_email}</p>
              </td>
              <td className="px-4 py-3 font-medium text-ink">{kind.nameOf(a)}</td>
              <td className="px-4 py-3 text-muted">{a.university_name || "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONES[a.status] || "slate"}>{STATUS_LABELS[a.status] || a.status}</Badge>
                {a.status === "rejected" && a.reason && <p className="mt-1 text-xs text-danger">{a.reason}</p>}
              </td>
              <td className="px-4 py-3 text-muted">{fmtDate(a.submitted_at || a.created_at)}</td>
              <td className="px-4 py-3 text-muted">{a.agreement_version ? `v${a.agreement_version}` : "—"}</td>
              <td className="px-4 py-3">
                {a.status === "pending_review" ? (
                  rejectingId === a.id ? (
                    <div className="min-w-[240px] space-y-2">
                      <TextArea
                        label="Rejection reason (required)"
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" disabled={busyId === a.id || rejectReason.trim().length < 2} onClick={() => confirmReject(a)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="accent" disabled={busyId === a.id} onClick={() => decide(a, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" disabled={busyId === a.id} onClick={() => decide(a, "reject")}>
                        Reject
                      </Button>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {apps !== null && apps.length > 0 && (
        <div className="mt-4 space-y-2 lg:hidden">
          {apps.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{kind.nameOf(a)}</p>
                <Badge tone={STATUS_TONES[a.status] || "slate"}>{STATUS_LABELS[a.status] || a.status}</Badge>
              </div>
              <p className="text-xs text-muted">
                {a.applicant_name} · {a.university_name || "No campus"} · {fmtDate(a.submitted_at || a.created_at)}
              </p>
              {a.status === "pending_review" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="accent" disabled={busyId === a.id} onClick={() => decide(a, "approve")}>Approve</Button>
                  <Button size="sm" variant="danger" disabled={busyId === a.id} onClick={() => decide(a, "reject")}>Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
