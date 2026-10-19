import axios from "axios";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // A 401 here means bad credentials, not an expired session -- say so in
      // plain words rather than surfacing the API's "Incorrect email or
      // password" verbatim alongside a stack of axios noise.
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(getErrorMessage(err, "Could not sign you in. Please try again."));
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-accent-700 underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />

        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={submitting}
          disabled={!email || !password}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
