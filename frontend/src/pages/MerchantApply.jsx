import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth, errMsg } from "../context/AuthContext";
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  PageHeader,
  Spinner,
  SuccessBanner,
  TextArea,
} from "../components/ui";
import TermsAgreement, { useTerms } from "../components/TermsAgreement";

export default function MerchantApply() {
  const { user, reload } = useAuth();
  const { terms, error: termsError } = useTerms("merchant");
  const [status, setStatus] = useState(undefined); // undefined = loading
  const [form, setForm] = useState({ businessName: "", category: "", contactInfo: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(() => {
    client
      .get("/merchants/applications/mine")
      .then(({ data }) => setStatus(data.applications?.[0] || null))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/merchants/apply", {
        ...form,
        terms: { accepted: true, version: terms.version },
      });
      setSuccess("Application submitted! Your Gibiychen merchant application is waiting for campus admin review.");
      await reload();
      loadStatus();
    } catch (err) {
      setError(errMsg(err, "Could not submit application"));
    } finally {
      setLoading(false);
    }
  }

  if (user?.role === "merchant") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <PageHeader title="You're a Gibiychen Merchant" subtitle="Your merchant application was approved." />
        <Card className="p-6 text-center space-y-3">
          <Badge tone="ok">Merchant</Badge>
          <p className="text-sm text-muted">
            Use your Merchant Dashboard to manage your store, products, orders and sales.
          </p>
          <Button as={Link} to="/merchant" variant="primary">Open Merchant Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (user && user.role !== "student") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <PageHeader title="Become a Merchant" />
        <Alert tone="info" title="Not available for this account">
          Merchant applications are submitted from student accounts. Your account is currently a{" "}
          {user.role} account.
        </Alert>
      </div>
    );
  }

  const latest = status; // latest application, any status
  const pending = latest?.status === "pending_review";
  const rejected = latest?.status === "rejected";
  const approved = latest?.status === "approved";

  return (
    <div className="mx-auto max-w-3xl py-8">
      <PageHeader
        title="Become a Gibiychen Merchant"
        subtitle="Apply to open a store on ግቢያችን. A campus administrator reviews every application — the merchant role is never granted instantly."
      />

      {status === undefined ? (
        <Card className="p-6"><Spinner /></Card>
      ) : (
        <div className="space-y-6">
          {pending && (
            <Alert tone="warn" title="Application pending review">
              Your merchant application was submitted on{" "}
              {new Date(latest.submittedAt || latest.createdAt).toLocaleString()} and is waiting for a
              campus administrator. You'll be notified when it's decided.
            </Alert>
          )}
          {approved && (
            <Alert tone="ok" title="Application approved">
              Your merchant application was approved. Open the Merchant Dashboard to start selling.
            </Alert>
          )}
          {rejected && (
            <Alert tone="danger" title="Application rejected">
              <p>
                Reason: <strong>{latest.reason || "Not specified"}</strong>
              </p>
              <p className="mt-1">You can update your details and reapply below.</p>
            </Alert>
          )}

          {!pending && !approved && (
            <>
              <form id="merchant-apply-form" onSubmit={onSubmit} className="space-y-6">
                <Card className="glass-panel p-6">
                  <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Store information
                  </h2>
                  <div className="space-y-4">
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <Input
                      label="Store / business name"
                      required
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    />
                    <Input
                      label="Business category"
                      placeholder="e.g. Stationery, Food, Printing"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                    <TextArea
                      label="Contact & location"
                      placeholder="Phone / Telegram / where on campus you operate"
                      value={form.contactInfo}
                      onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
                    />
                    <p className="text-xs text-muted">
                      Your campus is taken from your Gibiychen account ({user?.university_name || "your university"}).
                    </p>
                  </div>
                </Card>

                <Card className="glass-panel p-6">
                  <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Merchant Terms
                  </h2>
                  <p className="mb-4 text-xs text-muted">
                    Read the full terms below. The commission rate and example are calculated from the
                    currently configured platform rate.
                  </p>
                  <TermsAgreement
                    type="merchant"
                    terms={terms}
                    error={termsError}
                    accepted={accepted}
                    onAcceptChange={setAccepted}
                  />
                </Card>
              </form>

              <div className="space-y-2">
                <Button
                  type="submit"
                  form="merchant-apply-form"
                  className="w-full"
                  disabled={loading || !accepted || !terms || !form.businessName.trim()}
                >
                  {loading ? "Submitting..." : "Submit merchant application"}
                </Button>
                {!accepted && terms && (
                  <p className="text-center text-xs text-muted">
                    Accept the Merchant Terms above to enable submission.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-center">
            <Button as={Link} to="/marketplace" variant="outline">Back to Marketplace</Button>
          </div>
        </div>
      )}
    </div>
  );
}
