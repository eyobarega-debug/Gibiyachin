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
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      const { data } = await client.post("/auth/forgot-password", { email: email.trim() });
      setMessage(data.message);
    } catch (err) {
      setError(errMsg(err, "Could not process that request"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your account email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@aastu.edu.et"
          value={email}
          error={fieldError}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
