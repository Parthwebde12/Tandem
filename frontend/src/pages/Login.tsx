import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";

const DEMO_PASSWORD = "password123";
const DEMO_ACCOUNTS = [
  { email: "alice@opsdesk.dev", name: "Alice", role: "Admin", team: "Support" },
  {
    email: "bob@opsdesk.dev",
    name: "Bob",
    role: "Manager",
    team: "Support · Engineering member",
  },
  { email: "carol@opsdesk.dev", name: "Carol", role: "Member", team: "Support" },
  { email: "dave@opsdesk.dev", name: "Dave", role: "Viewer", team: "Support" },
  { email: "erin@opsdesk.dev", name: "Erin", role: "Manager", team: "Engineering" },
] as const;

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/workspace";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedDemo, setSelectedDemo] = useState<(typeof DEMO_ACCOUNTS)[number]>(
    DEMO_ACCOUNTS[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function signIn(email: string, password: string) {
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password."
          : "Could not sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await signIn(email, password);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#20251c]">
      <header className="border-b border-[#e4e8dc] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#25351f] text-lg font-bold text-lime-200">
              T
            </span>
            <span className="text-lg font-bold tracking-tight">Tandem</span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-[#49633b] hover:underline">
            Back to preview
          </Link>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-5 sm:p-8">
        <section className="w-full max-w-lg rounded-3xl border border-[#e3e8dc] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#718363]">
            Team workspace
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Sign in with your Tandem account to continue to your team’s work.
          </p>

          <div className="mt-5 rounded-2xl border border-[#e3e8dc] bg-[#f7f9f3] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Explore with a demo role</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Each account has different team permissions and actions.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => {
                const selected = selectedDemo.email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    aria-pressed={selected}
                    disabled={submitting}
                    onClick={() => setSelectedDemo(account)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[#9db28a] bg-white ring-2 ring-[#dce8d1]"
                        : "border-[#e3e8dc] bg-white hover:border-[#cfdac4]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{account.name}</span>
                      <span className="rounded-full bg-[#f0f4eb] px-2 py-0.5 text-[10px] font-semibold text-[#49633b]">
                        {account.role}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] text-gray-500">{account.team}</span>
                  </button>
                );
              })}
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-white px-3 py-2">
                <dt className="font-medium text-gray-400">Selected account</dt>
                <dd className="mt-0.5 select-all font-semibold text-gray-700">
                  {selectedDemo.email}
                </dd>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <dt className="font-medium text-gray-400">Demo password</dt>
                <dd className="mt-0.5 select-all font-semibold text-gray-700">{DEMO_PASSWORD}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void signIn(selectedDemo.email, DEMO_PASSWORD)}
              className="mt-3 w-full rounded-xl border border-[#cfdac4] bg-white px-3 py-2.5 text-sm font-semibold text-[#3c5531] transition hover:bg-[#edf2e4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Signing in…"
                : `Explore as ${selectedDemo.name} · ${selectedDemo.role}`}
            </button>
            <p className="mt-2 text-[11px] leading-4 text-gray-400">
              Demo accounts are shared and intended only for fictional sample data.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#304329] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#25351f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in with your account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}