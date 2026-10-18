import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Button, ErrorBanner, Input, SuccessBanner } from "../components/ui";
import AuthCard from "../components/AuthCard";

export default function ResetPassword() {
  const { token: routeToken } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(routeToken || params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const hasTokenInUrl = Boolean(routeToken || params.get("token"));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const errs = {};
    if (!token.trim()) {
      errs.token = "The reset token is required. Please use the link in your email or paste the token.";
    }
    if (!newPassword) {
      errs.password = "New password is required.";
    } else if (newPassword.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Confirm your new password.";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { data } = await client.post("/auth/reset-password", {
        token: token.trim(),
        newPassword,
      });
      setSuccess(data.message || "Password updated successfully. All previous sessions have been signed out.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(errMsg(err, "Could not reset password — the link may have expired or is invalid."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle="Enter and confirm your new Gibiyachin password below."
      footer={
        <Link to="/login" className="font-medium text-ink underline decoration-slate-300 hover:decoration-slate-500">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        {error && error.toLowerCase().includes("expired") && (
          <div className="text-center text-xs text-muted">
            <Link to="/forgot-password" className="font-semibold text-ink underline decoration-slate-300 hover:decoration-slate-500">
              Request a new password reset link &rarr;
            </Link>
          </div>
        )}
        <SuccessBanner message={success} />

        {!hasTokenInUrl && (
          <Input
            label="Reset token"
            required
            placeholder="Paste the token from your reset email"
            value={token}
            error={fieldErrors.token}
            onChange={(e) => {
              setToken(e.target.value);
              if (fieldErrors.token) setFieldErrors({ ...fieldErrors, token: "" });
            }}
          />
        )}

        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          hint="Must be at least 8 characters."
          value={newPassword}
          error={fieldErrors.password}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
          }}
        />

        <Input
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: "" });
          }}
        />

        <Button type="submit" className="w-full" loading={loading} disabled={loading || Boolean(success)}>
          {loading ? "Updating password…" : success ? "Redirecting to login…" : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}
