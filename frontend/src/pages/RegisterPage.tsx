import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { AuthLayout } from "./AuthLayout";

/** Matches the backend's Pydantic constraint, so the 422 never has to fire. */
const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (passwordTooShort) return;

    setError(null);
    setSubmitting(true);

    try {
      // Registers, then signs in with the same credentials -- no second form.
      await register(email.trim(), password, fullName.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not create your account. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up a workspace in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-accent-700 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Full name"
          name="full_name"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          autoFocus
        />

        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={passwordTooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={submitting}
          disabled={!fullName || !email || password.length < MIN_PASSWORD_LENGTH}
        >
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
