import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Button, ErrorBanner, Input, SuccessBanner } from "../components/ui";
import AuthCard from "../components/AuthCard";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const errs = {};
    if (!token.trim()) errs.token = "The reset token from your email is required.";
    if (newPassword.length < 8) errs.password = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await client.post("/auth/reset-password", { token: token.trim(), newPassword });
      setSuccess("Password updated. All previous sessions were signed out for security.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(errMsg(err, "Could not reset password — the link may have expired"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="Paste the reset token from your email and choose a new password."
      footer={
        <Link to="/login" className="font-medium text-primary underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <Input
          label="Reset token"
          required
          placeholder="Paste the token from your reset email"
          value={token}
          error={fieldErrors.token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          hint="Use at least 8 characters."
          value={newPassword}
          error={fieldErrors.password}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}
