import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-100 px-4">
      <div className="text-center">
        <p className="text-[13px] font-medium tracking-wide text-ink-400 uppercase">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          That page doesn't exist, or it hasn't been built yet.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-10 items-center rounded-md border border-accent-600 bg-accent-600 px-4 text-sm font-medium text-white transition-colors hover:bg-accent-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
