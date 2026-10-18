import { useEffect, useState } from "react";
import { client, errMsg } from "../../api/client";
import { Alert, Badge, Button, Card, EmptyState, ErrorBanner, Input, LoadingState, PageHeader, Select, Table } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { fmtDate, fmtMoney } from "./constants";

const DEFAULT_FORM = { universityId: "", commissionRate: "", featuredRatePerDay: "", effectiveFrom: "" };

export default function SuperAdminSettings() {
  const toast = useToast();
  const [schedules, setSchedules] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [fs, uni] = await Promise.all([
        client.get("/super/fee-schedules"),
        client.get("/super/universities"),
      ]);
      setSchedules(fs.data.feeSchedules || []);
      setCampuses(uni.data.universities || []);
    } catch (err) {
      setError(errMsg(err, "Could not load platform settings"));
      setSchedules([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    const commission = Number(form.commissionRate);
    const featured = Number(form.featuredRatePerDay || 0);
    if (!Number.isFinite(commission) || commission < 0 || commission > 50) {
      setFormError("Commission rate must be between 0 and 50 percent.");
      return;
    }
    if (!Number.isFinite(featured) || featured < 0) {
      setFormError("Featured rate must be zero or more.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        commissionRate: commission / 100,
        featuredRatePerDay: featured,
      };
      if (form.universityId) payload.universityId = form.universityId;
      if (form.effectiveFrom) payload.effectiveFrom = new Date(form.effectiveFrom).toISOString();
      await client.post("/super/fee-schedules", payload);
      toast.success("Fee schedule added.");
      setForm(DEFAULT_FORM);
      await load();
    } catch (err) {
      setFormError(errMsg(err, "Could not create the fee schedule"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Platform Settings"
        subtitle="Fees and commissions are the settings the backend currently exposes."
      />

      <ErrorBanner message={error} onClose={() => setError("")} />

      <Alert tone="info" title="What is (and isn't) configurable here">
        This deployment exposes <strong>fee schedules</strong> and per-campus feature flags (under Campuses) only.
        Platform settings, payment-provider configuration, email/OTP configuration and security settings have no
        backend API, so no UI is provided. Secret values are never exposed to the browser.
      </Alert>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink">Add a fee schedule</h2>
        <p className="mt-0.5 text-xs text-muted">
          Schedules are append-only — the newest effective row wins. Omit the campus for the platform default.
        </p>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Applies to"
            value={form.universityId}
            onChange={(e) => setForm({ ...form, universityId: e.target.value })}
          >
            <option value="">Platform default</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Commission rate (%)"
            type="number"
            min={0}
            max={50}
            step="0.1"
            required
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            hint="0–50%. Stored as a fraction."
          />
          <Input
            label="Featured rate / day (ETB)"
            type="number"
            min={0}
            step="0.01"
            value={form.featuredRatePerDay}
            onChange={(e) => setForm({ ...form, featuredRatePerDay: e.target.value })}
          />
          <Input
            label="Effective from"
            type="datetime-local"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            hint="Optional. Defaults to now."
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <ErrorBanner message={formError} onClose={() => setFormError("")} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" loading={busy}>
              Add schedule
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        {schedules === null ? (
          <LoadingState label="Loading fee schedules…" />
        ) : schedules.length === 0 ? (
          <EmptyState icon="commission" title="No fee schedules" subtitle="Add a platform default to get started." />
        ) : (
          <Table head={["Scope", "Commission", "Featured / day", "Effective from", "Created"]}>
            {schedules.map((s) => (
              <tr key={s.id} className="text-slate-700">
                <td className="px-4 py-3 font-medium text-ink">
                  {s.university_id ? s.university_name || "Campus" : <Badge tone="accent">Platform default</Badge>}
                </td>
                <td className="px-4 py-3">{(Number(s.commission_rate) * 100).toFixed(2)}%</td>
                <td className="px-4 py-3">{fmtMoney(s.featured_rate_per_day)}</td>
                <td className="px-4 py-3 text-muted">{fmtDate(s.effective_from)}</td>
                <td className="px-4 py-3 text-muted">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <TermsVersionsSection />
    </div>
  );
}

const EMPTY_SECTION = { heading: "", items: "" };

function TermsVersionsSection() {
  const toast = useToast();
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    agreementType: "merchant_terms",
    version: "",
    title: "",
    intro: "",
  });
  const [sections, setSections] = useState([{ ...EMPTY_SECTION }]);

  async function load() {
    setError("");
    try {
      const { data } = await client.get("/super/terms");
      setVersions(data.versions || []);
    } catch (err) {
      setError(errMsg(err, "Could not load terms versions"));
      setVersions([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setSection(i, patch) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    const content = sections
      .map((s) => ({
        heading: s.heading.trim(),
        items: s.items.split("\n").map((line) => line.trim()).filter(Boolean),
      }))
      .filter((s) => s.heading && s.items.length > 0);
    if (!form.version.trim() || !form.title.trim()) {
      setFormError("Version and title are required.");
      return;
    }
    if (content.length === 0) {
      setFormError("Add at least one section with a heading and one item per line.");
      return;
    }
    setBusy(true);
    try {
      await client.post("/super/terms", {
        agreementType: form.agreementType,
        version: form.version.trim(),
        title: form.title.trim(),
        intro: form.intro.trim() || undefined,
        content,
      });
      toast.success(`Published ${form.agreementType.replace("_", " ")} v${form.version.trim()} — it is now the active version.`);
      setForm({ agreementType: "merchant_terms", version: "", title: "", intro: "" });
      setSections([{ ...EMPTY_SECTION }]);
      await load();
    } catch (err) {
      setFormError(errMsg(err, "Could not publish the terms version"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-base font-bold text-ink">Terms &amp; policy versions</h2>
      <p className="mt-0.5 text-xs text-muted">
        Merchant and Organizer Terms are versioned. Publishing a new version makes it active for new
        applications; historical agreements keep pointing at the version that was accepted. Commission
        rates shown with the terms come from the fee schedules above.
      </p>

      <ErrorBanner message={error} onClose={() => setError("")} />

      <Card className="mt-4 p-5">
        <h3 className="text-sm font-semibold text-ink">Publish a new version</h3>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Terms type"
              value={form.agreementType}
              onChange={(e) => setForm({ ...form, agreementType: e.target.value })}
            >
              <option value="merchant_terms">Merchant Terms</option>
              <option value="organizer_terms">Organizer Terms</option>
            </Select>
            <Input
              label="Version"
              placeholder="e.g. 2.0"
              required
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
            />
            <Input
              label="Title"
              placeholder="e.g. Gibiychin Merchant Terms v2.0"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <TextArea
            label="Intro (optional)"
            rows={2}
            value={form.intro}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
          />
          {sections.map((s, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-slate-200/80 p-3 sm:grid-cols-2">
              <Input
                label={`Section ${i + 1} heading`}
                value={s.heading}
                onChange={(e) => setSection(i, { heading: e.target.value })}
              />
              <TextArea
                label="Items (one per line)"
                rows={4}
                value={s.items}
                onChange={(e) => setSection(i, { items: e.target.value })}
              />
              {sections.length > 1 && (
                <div className="sm:col-span-2">
                  <Button size="sm" variant="ghost" type="button" onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))}>
                    Remove section
                  </Button>
                </div>
              )}
            </div>
          ))}
          <ErrorBanner message={formError} onClose={() => setFormError("")} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setSections((prev) => [...prev, { ...EMPTY_SECTION }])}>
              Add section
            </Button>
            <Button type="submit" loading={busy}>Publish version</Button>
          </div>
        </form>
      </Card>

      <div className="mt-4">
        {versions === null ? (
          <LoadingState label="Loading terms versions…" />
        ) : versions.length === 0 ? (
          <EmptyState icon="file" title="No terms versions" subtitle="Publish the first version above." />
        ) : (
          <Table head={["Type", "Version", "Title", "Status", "Effective from", "Published"]}>
            {versions.map((v) => (
              <tr key={v.id} className="text-slate-700">
                <td className="px-4 py-3 font-medium text-ink">
                  {v.agreement_type === "merchant_terms" ? "Merchant" : "Organizer"}
                </td>
                <td className="px-4 py-3">v{v.version}</td>
                <td className="px-4 py-3">{v.title}</td>
                <td className="px-4 py-3">
                  {v.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="slate">Superseded</Badge>}
                </td>
                <td className="px-4 py-3 text-muted">{fmtDate(v.effective_from)}</td>
                <td className="px-4 py-3 text-muted">{fmtDate(v.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
