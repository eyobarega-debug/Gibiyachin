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
  Select,
  Spinner,
  SuccessBanner,
  TextArea,
} from "../components/ui";
import TermsAgreement, { useTerms } from "../components/TermsAgreement";

const ORGANIZER_TYPES = [
  { value: "club", label: "Student club" },
  { value: "association", label: "Association" },
  { value: "department", label: "Department / faculty" },
  { value: "individual", label: "Individual organizer" },
  { value: "other", label: "Other" },
];

export default function OrganizerApply() {
  const { user, reload } = useAuth();
  const { terms, error: termsError } = useTerms("organizer");
  const [status, setStatus] = useState(undefined); // undefined = loading
  const [form, setForm] = useState({
    organizerName: "",
    organizationName: "",
    description: "",
    phone: "",
    organizerType: "individual",
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(() => {
    client
      .get("/organizers/applications/mine")
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
      await client.post("/organizers/apply", {
        ...form,
        organizationName: form.organizationName || undefined,
        description: form.description || undefined,
        phone: form.phone || undefined,
        terms: { accepted: true, version: terms.version },
      });
      setSuccess("Application submitted! Your Gibiychen organizer application is waiting for campus admin review.");
      await reload();
      loadStatus();
    } catch (err) {
      setError(errMsg(err, "Could not submit application"));
    } finally {
      setLoading(false);
    }
  }

  if (user?.role === "organizer") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <PageHeader title="You're a Gibiychen Event Organizer" subtitle="Your organizer application was approved." />
        <Card className="p-6 text-center space-y-3">
          <Badge tone="ok">Event Organizer</Badge>
          <p className="text-sm text-muted">
            Use the Organizer Dashboard to create events, configure tickets and manage attendees.
          </p>
          <Button as={Link} to="/organizer" variant="primary">Open Organizer Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (user && user.role !== "student") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <PageHeader title="Become an Organizer" />
        <Alert tone="info" title="Not available for this account">
          Organizer applications are submitted from student accounts. Your account is currently a{" "}
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
        title="Become a Gibiychen Event Organizer"
        subtitle="Apply to host events and sell tickets on ግቢያችን. A campus administrator reviews every application — the organizer role is never granted instantly."
      />

      {status === undefined ? (
        <Card className="p-6"><Spinner /></Card>
      ) : (
        <div className="space-y-6">
          {pending && (
            <Alert tone="warn" title="Application pending review">
              Your organizer application was submitted on{" "}
              {new Date(latest.submittedAt || latest.createdAt).toLocaleString()} and is waiting for a
              campus administrator. You'll be notified when it's decided.
            </Alert>
          )}
          {approved && (
            <Alert tone="ok" title="Application approved">
              Your organizer application was approved. Open the Organizer Dashboard to create your first event.
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
              <form id="organizer-apply-form" onSubmit={onSubmit} className="space-y-6">
                <Card className="glass-panel p-6">
                  <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Organizer information
                  </h2>
                  <div className="space-y-4">
                    <ErrorBanner message={error} />
                    <SuccessBanner message={success} />
                    <Input
                      label="Organizer name"
                      required
                      placeholder="Your name or the name shown to attendees"
                      value={form.organizerName}
                      onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                    />
                    <Input
                      label="Club / organization name (optional)"
                      placeholder="e.g. Robotics Club, Student Union"
                      value={form.organizationName}
                      onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                    />
                    <Select
                      label="Organizer type"
                      value={form.organizerType}
                      onChange={(e) => setForm({ ...form, organizerType: e.target.value })}
                    >
                      {ORGANIZER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                    <Input
                      label="Contact phone (optional)"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <TextArea
                      label="Description (optional)"
                      placeholder="What kind of events do you plan to host?"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                    <p className="text-xs text-muted">
                      Your campus is taken from your Gibiychen account ({user?.university_name || "your university"}).
                    </p>
                  </div>
                </Card>

                <Card className="glass-panel p-6">
                  <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Organizer Terms
                  </h2>
                  <p className="mb-4 text-xs text-muted">
                    Read the full terms below. The ticket commission rate and example are calculated
                    from the currently configured platform rate.
                  </p>
                  <TermsAgreement
                    type="organizer"
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
                  form="organizer-apply-form"
                  className="w-full"
                  disabled={loading || !accepted || !terms || !form.organizerName.trim()}
                >
                  {loading ? "Submitting..." : "Submit organizer application"}
                </Button>
                {!accepted && terms && (
                  <p className="text-center text-xs text-muted">
                    Accept the Organizer Terms above to enable submission.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-center">
            <Button as={Link} to="/events" variant="outline">Back to Events</Button>
          </div>
        </div>
      )}
    </div>
  );
}
