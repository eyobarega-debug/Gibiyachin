import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, errMsg } from "../context/AuthContext";
import { Button, ErrorBanner, Input, SuccessBanner } from "../components/ui";
import AuthCard from "../components/AuthCard";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(location.state?.error || "");
  const [loading, setLoading] = useState(false);
  const [flash] = useState(location.state?.flash || "");

  useEffect(() => {
    if (location.state?.error) setError(location.state.error);
  }, [location.state?.error]);

  function validate() {
    const errs = {};
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Enter a valid email address.";
    if (!form.password) errs.password = "Password is required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      const dest = location.state?.from?.pathname || roleHome(user.role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(errMsg(err, "Could not log in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Welcome back to ግቢያችን (Gibiyachin).">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <SuccessBanner message={flash} />
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
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          error={fieldErrors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        No account?{" "}
        <Link to="/register" className="font-medium text-ink underline decoration-slate-300 hover:decoration-slate-500">
          Sign up
        </Link>
      </p>
      <p className="mt-1 text-center text-sm text-muted">
        <Link to="/forgot-password" className="underline decoration-slate-300 hover:decoration-slate-500">
          Forgot your password?
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-slate-200/80 bg-white/70 p-3.5 text-xs text-muted shadow-xs">
        <p className="mb-1 font-semibold text-ink">Demo accounts (password: Password123!)</p>
        <p>admin@aastu.edu.et · sara@aastu.edu.et · selam@aastu.edu.et (merchant) · robel@aastu.edu.et (organizer)</p>
      </div>
    </AuthCard>
  );
}

export function roleHome(role) {
  return { merchant: "/merchant", organizer: "/organizer", admin: "/admin" }[role] || "/marketplace";
}
