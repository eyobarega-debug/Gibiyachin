import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Button, ErrorBanner, Input, Select, SuccessBanner } from "../components/ui";
import AuthCard from "../components/AuthCard";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function Register() {
  const navigate = useNavigate();
  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "student", universityId: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    client
      .get("/meta/universities")
      .then(({ data }) => {
        if (alive) setUniversities(data.universities);
      })
      .catch(() => {
        /* universities are optional for rendering the form */
      });
    return () => {
      alive = false;
    };
  }, []);

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Enter a valid email address.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await client.post("/auth/register", { ...form, universityId: form.universityId || undefined });
      // Next step is email OTP verification. Stash the email so a refresh
      // doesn't strand the student, then hand off to the verification page.
      sessionStorage.setItem("ch_pending_verify_email", form.email);
      setSuccess(data.message);
      setTimeout(
        () =>
          navigate("/verify-email", {
            state: {
              email: form.email,
              expiresInSeconds: data.expiresInSeconds,
              resendCooldownSeconds: data.resendCooldownSeconds,
              devOtp: data.devOtp,
            },
          }),
        1400,
      );
    } catch (err) {
      setError(errMsg(err, "Could not register"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join ግቢያችን (Gibiyachin) as a student — you can apply to become a merchant later."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-ink underline decoration-slate-300 hover:decoration-slate-500">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />

        <Input
          label="Full name"
          required
          autoComplete="name"
          placeholder="e.g. Sara Bekele"
          value={form.name}
          error={fieldErrors.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@aastu.edu.et"
          value={form.email}
          error={fieldErrors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          placeholder="09…"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Select
          label="University"
          required
          value={form.universityId}
          onChange={(e) => setForm({ ...form, universityId: e.target.value })}
        >
          <option value="">Select your university</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted">
          Using your university email auto-verifies you (FR-002). Otherwise an admin reviews your account.
        </p>

        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          hint="Use at least 8 characters."
          value={form.password}
          error={fieldErrors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
