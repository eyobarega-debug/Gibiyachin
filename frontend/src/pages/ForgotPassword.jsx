import { useState } from "react";
import { Link } from "react-router-dom";
import { client } from "../api/client";
import { errMsg } from "../context/AuthContext";
import { Button, ErrorBanner, Input, SuccessBanner } from "../components/ui";
import AuthCard from "../components/AuthCard";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Email is required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setFieldError("Enter a valid university email address.");
      return;
    }
    setFieldError("");
    setLoading(true);

    try {
      const { data } = await client.post("/auth/forgot-password", { email: trimmed });
      setMessage(data.message || "If that email is registered, a password reset link has been sent.");
    } catch (err) {
      setError(errMsg(err, "Could not process your request. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your account email and we'll send you a password reset link."
      footer={
        <Link to="/login" className="font-medium text-ink underline decoration-slate-300 hover:decoration-slate-500">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        {message ? (
          <div className="space-y-4">
            <SuccessBanner message={message} />
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 text-xs text-muted shadow-xs">
              <p className="font-semibold text-ink">What to do next:</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1">
                <li>Check your inbox for an email from <strong>Gibiyachin (ግቢያችን)</strong>.</li>
                <li>Click the secure <strong>Reset Password</strong> button in the email.</li>
                <li>The link is single-use and expires in 1 hour.</li>
              </ul>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() => {
                setMessage("");
                setEmail("");
              }}
            >
              Use a different email address
            </Button>
          </div>
        ) : (
          <>
            <Input
              label="University Email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@campus.edu.et"
              value={email}
              error={fieldError}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldError) setFieldError("");
              }}
            />
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "Sending reset link…" : "Send reset link"}
            </Button>
          </>
        )}
      </form>
    </AuthCard>
  );
}
