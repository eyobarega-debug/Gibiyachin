import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Badge, Button, Card, ErrorBanner, Input, PageHeader, Spinner, SuccessBanner } from "../components/ui";
import ProofImage from "../components/ProofImage";
import { useConfirm } from "../components/ConfirmProvider";

export const METHOD_LABEL = {
  cbe: "Commercial Bank of Ethiopia",
  telebirr: "Telebirr",
  awash: "Awash Bank",
  dashen: "Dashen Bank",
  abyssinia: "Bank of Abyssinia",
  other: "Other",
};

const STATUS = {
  pending: { tone: "warn", text: "Waiting for your payment proof" },
  under_review: { tone: "accent", text: "Waiting for the seller to approve" },
  confirmed: { tone: "ok", text: "Approved" },
  failed: { tone: "danger", text: "Cancelled" },
  refunded: { tone: "slate", text: "Refunded" },
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function ManualPayment() {
  const { paymentId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);
  const fileInput = useRef(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/payments/${paymentId}/manual`);
      setData(res.data);
    } catch (err) {
      setError(errMsg(err, "Could not load this payment"));
    }
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the seller hasn't decided yet, keep the page fresh.
  const status = data?.payment.status;
  useEffect(() => {
    if (status !== "under_review") return undefined;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [status, load]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!file) return setError("Attach a screenshot of your payment");
    const form = new FormData();
    form.append("screenshot", file);
    form.append("referenceNumber", reference.trim());
    setBusy(true);
    try {
      await client.post(`/payments/${paymentId}/proof`, form);
      setSuccess("Sent. The seller will check their account and approve your payment.");
      setFile(null);
      setReference("");
      if (fileInput.current) fileInput.current.value = "";
      setImgVersion((v) => v + 1);
      await load();
    } catch (err) {
      setError(errMsg(err, "Could not upload your proof"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelPurchase() {
    const ok = await confirm({
      title: "Cancel purchase?",
      message: "Cancel this purchase? Your reservation will be released.",
      confirmLabel: "Cancel purchase",
      variant: "danger",
    });
    if (!ok) return;
    setError("");
    try {
      await client.post(`/payments/${paymentId}/cancel`, {});
      navigate("/payment-approvals");
    } catch (err) {
      setError(errMsg(err, "Could not cancel this purchase"));
    }
  }

  if (!data) {
    return error ? (
      <div className="mx-auto max-w-lg py-10"><ErrorBanner message={error} /></div>
    ) : (
      <div className="flex justify-center py-16"><Spinner /></div>
    );
  }

  const { payment, payeeAccounts, proofs, payeeName, viewerRole } = data;
  const s = STATUS[payment.status] || STATUS.pending;
  const lastProof = proofs[0];
  const attemptsLeft = payment.maxAttempts - payment.proofAttempts;
  const returnTo = state?.returnTo || "/";
  const label = state?.label || payment.description || "Your purchase";

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Pay the seller directly"
        subtitle={label}
        action={<Badge tone={s.tone}>{s.text}</Badge>}
      />

      <Card className="mb-4 p-6">
        <p className="text-sm text-muted">Amount to send</p>
        <p className="text-3xl font-bold text-ink">{payment.amount.toFixed(2)} <span className="text-lg font-medium text-muted">ETB</span></p>
        {payment.status === "pending" && (
          <p className="mt-2 text-xs text-muted">
            Your items are reserved until {new Date(payment.expiresAt).toLocaleString()}. After that the reservation is released.
          </p>
        )}
      </Card>

      {viewerRole !== "payer" && (
        <Card className="mb-4 p-4 text-sm text-muted">
          You're viewing this as {viewerRole === "payee" ? "the seller" : "an admin"}.{" "}
          <Link className="font-medium text-ink underline decoration-slate-300" to="/payment-approvals">Go to payment approvals</Link>
        </Card>
      )}

      <Card className="mb-4 p-6 border border-white/90 bg-white/80 shadow-md">
        <h2 className="mb-1 font-semibold text-ink">1. Send {payment.amount.toFixed(2)} ETB to {payeeName}</h2>
        <p className="mb-3 text-sm text-muted">Use any one of these accounts, for exactly this amount.</p>
        <div className="space-y-3">
          {payeeAccounts.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200/80 bg-white/70 p-3.5 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{METHOD_LABEL[a.method] || a.method}</p>
              <p className="text-sm font-semibold text-ink">{a.accountName}</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-lg font-bold text-ink">{a.accountNumber}</p>
                <CopyButton value={a.accountNumber} />
              </div>
              {a.instructions && <p className="mt-1 text-xs text-muted">Note from the seller: {a.instructions}</p>}
            </div>
          ))}
        </div>
      </Card>

      {payment.status === "pending" && viewerRole === "payer" && (
        <Card className="mb-4 p-6 border border-white/90 bg-white/80 shadow-md">
          <h2 className="mb-1 font-semibold text-ink">2. Upload your payment proof</h2>
          <p className="mb-3 text-sm text-muted">
            A screenshot of the bank / Telebirr confirmation, plus the transaction reference shown on it.
            Edited or reused screenshots and references are rejected.
          </p>
          {lastProof?.status === "rejected" && (
            <div className="mb-3 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              The seller rejected your last proof: <strong>{lastProof.rejectReason}</strong>.{" "}
              {attemptsLeft > 0 ? `You can try again (${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left).` : ""}
            </div>
          )}
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />
          <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Screenshot <span className="text-danger">*</span>
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full cursor-pointer rounded-xl border border-slate-200/80 bg-white/70 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-l-xl file:border-0 file:bg-slate-800 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-muted">JPG, PNG or WEBP, max 5MB</span>
            </label>
            <Input
              label="Transaction reference"
              required
              placeholder="e.g. FT26287ABCDE"
              hint="Shown on your bank or Telebirr confirmation."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              minLength={4}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={busy} disabled={busy || attemptsLeft <= 0}>
                {busy ? "Uploading…" : "Submit proof"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelPurchase} disabled={busy}>
                Cancel purchase
              </Button>
            </div>
          </form>
        </Card>
      )}

      {payment.status === "under_review" && (
        <Card className="mb-4 p-6">
          <h2 className="mb-1 font-semibold text-ink">Proof sent</h2>
          <SuccessBanner message={success} />
          <p className="mb-3 mt-2 text-sm text-muted">
            {payeeName} has been notified. Your ticket / order is confirmed as soon as they approve it. This page updates by itself.
          </p>
          {lastProof && <p className="mb-3 text-xs text-muted">Reference: <span className="font-mono text-ink">{lastProof.referenceNumber}</span></p>}
          <ProofImage paymentId={payment.id} version={imgVersion} />
        </Card>
      )}

      {payment.status === "confirmed" && (
        <Card className="mb-4 p-6 text-center">
          <p className="mb-3 font-semibold text-ok">{payeeName} approved your payment.</p>
          <Button as={Link} to={returnTo} variant="accent">Continue</Button>
        </Card>
      )}

      {payment.status === "failed" && (
        <Card className="mb-4 p-6 text-center">
          <p className="mb-1 font-semibold text-danger">This purchase was cancelled.</p>
          {lastProof?.status === "rejected" && <p className="mb-3 text-sm text-muted">Reason: {lastProof.rejectReason}</p>}
          <Button as={Link} to="/payment-approvals" variant="outline">My payments</Button>
        </Card>
      )}
    </div>
  );
}