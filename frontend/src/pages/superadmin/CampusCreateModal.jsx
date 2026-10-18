import { useState } from "react";
import { client, errMsg } from "../../api/client";
import { Button, Checkbox, ErrorBanner, Input, Modal } from "../../components/ui";

const EMPTY = {
  name: "",
  code: "",
  city: "",
  region: "",
  slug: "",
  domain: "",
  permittedDomains: "",
  assignAdminNow: false,
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminPhone: "",
  initialClubs: "",
};

// Onboard a new tenant, with optional initial Campus Admin.
// Matches POST /api/super/universities.
export default function CampusCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(EMPTY);
    setError("");
    setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
      };
      if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.region.trim()) payload.region = form.region.trim();
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (form.domain.trim()) payload.domain = form.domain.trim();

      const domains = form.permittedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      if (domains.length) payload.permittedDomains = domains;

      if (form.assignAdminNow) {
        payload.admin = {
          name: form.adminName.trim(),
          email: form.adminEmail.trim(),
          password: form.adminPassword,
        };
        if (form.adminPhone.trim()) payload.admin.phone = form.adminPhone.trim();
      }

      const clubs = form.initialClubs
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      if (clubs.length) payload.initialClubs = clubs;

      const { data } = await client.post("/super/universities", payload);
      reset();
      onCreated?.(data.university);
    } catch (err) {
      setError(errMsg(err, "Could not create the campus"));
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    reset();
    onClose?.();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Onboard new campus"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="create-campus-form" loading={busy}>
            Create campus
          </Button>
        </>
      }
    >
      <form id="create-campus-form" onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError("")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Campus name" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Addis Ababa University" />
          <Input label="Short code / Acronym" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. AAU" hint="Optional uppercase code (e.g. AAU, ASTU)." />
          <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Addis Ababa" />
          <Input label="Region" value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="e.g. Addis Ababa / Oromia / Amhara" />
          <Input label="Slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="addis-ababa-university" hint="Optional. Lowercase letters, numbers and dashes." />
          <Input label="Primary domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="aau.edu.et" hint="Optional. Used for email-domain auto-verification." />
          <div className="sm:col-span-2">
            <Input label="Permitted domains" value={form.permittedDomains} onChange={(e) => set("permittedDomains", e.target.value)} placeholder="aau.edu.et, mail.aau.edu.et" hint="Optional, comma separated." />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-ink mb-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              checked={form.assignAdminNow}
              onChange={(e) => set("assignAdminNow", e.target.checked)}
            />
            <span>Assign initial Campus Admin now (optional)</span>
          </label>
          <p className="text-xs text-muted mb-3">
            If unchecked, the campus is created without an admin. You can create or assign an administrator later from the Campus Admins portal.
          </p>

          {form.assignAdminNow && (
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200/60">
              <Input label="Admin name" required={form.assignAdminNow} value={form.adminName} onChange={(e) => set("adminName", e.target.value)} />
              <Input label="Admin email" type="email" required={form.assignAdminNow} value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
              <Input label="Admin password" type="password" required={form.assignAdminNow} minLength={8} value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} hint="At least 8 characters." />
              <Input label="Admin phone" value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} />
            </div>
          )}
        </div>

        <Input label="Initial clubs" value={form.initialClubs} onChange={(e) => set("initialClubs", e.target.value)} placeholder="Computer Science Club, Debate Club" hint="Optional, comma separated (max 50)." />
      </form>
    </Modal>
  );
}
