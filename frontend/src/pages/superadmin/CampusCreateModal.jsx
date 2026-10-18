import { useState } from "react";
import { client, errMsg } from "../../api/client";
import { Button, ErrorBanner, Input, Modal } from "../../components/ui";

const EMPTY = {
  name: "",
  slug: "",
  domain: "",
  permittedDomains: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminPhone: "",
  initialClubs: "",
};

// Onboard a new tenant + its first University Administrator in one call.
// Matches POST /api/super/universities exactly.
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
        admin: {
          name: form.adminName.trim(),
          email: form.adminEmail.trim(),
          password: form.adminPassword,
        },
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (form.domain.trim()) payload.domain = form.domain.trim();
      const domains = form.permittedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      if (domains.length) payload.permittedDomains = domains;
      if (form.adminPhone.trim()) payload.admin.phone = form.adminPhone.trim();
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
          <Input label="Campus name" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Example University" />
          <Input label="Slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="example-university" hint="Optional. Lowercase letters, numbers and dashes." />
          <Input label="Primary domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="example.edu.et" hint="Optional. Used for email-domain auto-verification." />
          <Input label="Permitted domains" value={form.permittedDomains} onChange={(e) => set("permittedDomains", e.target.value)} placeholder="example.edu.et, mail.example.edu.et" hint="Optional, comma separated." />
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
          <p className="mb-3 text-sm font-semibold text-ink">First University Administrator</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Admin name" required value={form.adminName} onChange={(e) => set("adminName", e.target.value)} />
            <Input label="Admin email" type="email" required value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
            <Input label="Admin password" type="password" required minLength={8} value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} hint="At least 8 characters." />
            <Input label="Admin phone" value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} />
          </div>
        </div>

        <Input label="Initial clubs" value={form.initialClubs} onChange={(e) => set("initialClubs", e.target.value)} placeholder="Computer Science Club, Debate Club" hint="Optional, comma separated (max 50)." />
      </form>
    </Modal>
  );
}
