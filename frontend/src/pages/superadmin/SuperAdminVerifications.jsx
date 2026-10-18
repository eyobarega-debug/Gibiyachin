import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, LoadingState, Modal, PageHeader, Tabs, TextArea } from "../../components/ui";
import { useConfirm } from "../../components/ConfirmProvider";
import { useToast } from "../../components/Toast";
import VerificationDocument from "../../components/VerificationDocument";
import { VERIFICATION_STATUS_TONE, fmtDate, humanize } from "./constants";

export default function SuperAdminVerifications() {
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [openDoc, setOpenDoc] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  async function load() {
    setError("");
    try {
      const params = { status };
      if (q.trim()) params.q = q.trim();
      const { data } = await client.get("/admin/verifications/requests", { params });
      setRequests(data.requests || []);
    } catch (err) {
      setError(errMsg(err, "Could not load the verification queue"));
      setRequests([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(r) {
    const ok = await confirm({
      title: "Approve verification?",
      message: `${r.studentName} will be marked as a verified campus member.`,
      confirmLabel: "Approve",
      variant: "primary",
    });
    if (!ok) return;
    setBusyId(r.id);
    setError("");
    try {
      await client.patch(`/admin/verifications/requests/${r.id}/approve`, {});
      toast.success("Verification approved.");
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not approve the request"));
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject() {
    if (reason.trim().length < 2) {
      setRejectError("Please provide a short reason (at least 2 characters).");
      return;
    }
    setBusyId(rejecting.id);
    setRejectError("");
    try {
      await client.patch(`/admin/verifications/requests/${rejecting.id}/reject`, { rejectionReason: reason.trim() });
      toast.success("Verification rejected.");
      setRejecting(null);
      setReason("");
      await load();
    } catch (err) {
      setRejectError(errMsg(err, "Could not reject the request"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Verification Queue"
        subtitle="Review student verification documents from every campus."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs
          items={[
            { key: "pending", label: "Pending" },
            { key: "all", label: "All" },
          ]}
          value={status}
          onChange={setStatus}
        />
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="flex-1">
            <Input aria-label="Search requests" placeholder="Search student name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      <ErrorBanner message={error} onClose={() => setError("")} />

      {requests === null ? (
        <LoadingState label="Loading verification requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="verification"
          title={status === "pending" ? "No pending requests" : "No verification requests"}
          subtitle="Submitted student documents will appear here for review."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{r.studentName}</p>
                    <Badge tone={VERIFICATION_STATUS_TONE[r.status] || "slate"}>{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.studentEmail}
                    {r.studentPhone ? ` · ${r.studentPhone}` : ""} · {r.universityName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {humanize(r.documentType)} · submitted {fmtDate(r.createdAt)}
                    {r.reviewerName ? ` · reviewed by ${r.reviewerName}` : ""}
                  </p>
                  {r.studentNote && <p className="mt-2 text-sm text-slate-700">“{r.studentNote}”</p>}
                  {r.status === "rejected" && r.rejectionReason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      Rejection reason: {r.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.hasDocument && (
                    <Button size="sm" variant="outline" onClick={() => setOpenDoc(openDoc === r.id ? null : r.id)}>
                      {openDoc === r.id ? "Hide document" : "View document"}
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => approve(r)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejecting(r);
                          setReason("");
                          setRejectError("");
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {openDoc === r.id && (
                <div className="mt-4 border-t border-slate-200/80 pt-4">
                  <VerificationDocument url={`/admin/verifications/requests/${r.id}/document`} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!rejecting}
        onClose={() => (busyId ? null : setRejecting(null))}
        title="Reject verification"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button variant="danger" loading={busyId === rejecting?.id} onClick={submitReject}>
              Reject request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {rejecting ? `Rejecting ${rejecting.studentName}'s request.` : ""} The student will be notified with the reason.
          </p>
          <ErrorBanner message={rejectError} onClose={() => setRejectError("")} />
          <TextArea
            label="Reason"
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why the document could not be accepted…"
          />
        </div>
      </Modal>
    </div>
  );
}
