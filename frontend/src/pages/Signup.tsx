import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { SignupOptions, TeamRole } from "../api/types";
import { useAuth } from "../auth/useAuth";

const ROLE_INFO: Record<TeamRole, { label: string; help: string }> = {
  viewer: { label: "Viewer", help: "Can read items, history and comments." },
  member: { label: "Member", help: "Can create, claim, edit own items and comment." },
  manager: { label: "Manager", help: "Also assigns work, approves and closes." },
  admin: { label: "Admin", help: "Everything a manager can do." },
};

export default function Signup() {
  const { user, register } = useAuth();
  const options = useQuery({
    queryKey: ["signup-options"],
    queryFn: () => apiFetch<SignupOptions>("/auth/signup-options"),
    retry: false,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/workspace" replace />;
  }

  const data = options.data;
  const chosenTeam = teamId || data?.teams[0]?.id || "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        full_name: fullName,
        email,
        password,
        team_id: chosenTeam,
        role,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists. Try signing in.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Sign-up is closed.");
      } else if (err instanceof ApiError && err.status === 422) {
        setError("Please check your details (password needs 8 or more characters).");
      } else {
        setError("Could not create the account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
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
          <Link to="/login" className="text-sm font-semibold text-[#49633b] hover:underline">
            Sign in instead
          </Link>
        </div>
      </header>

      <div className="flex justify-center p-5 sm:p-8">
        <section className="w-full max-w-lg rounded-3xl border border-[#e3e8dc] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#718363]">
            Team workspace
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Use your own name and email, then choose a team and the role you want to
            try. Each role has different permissions.
          </p>

          {options.isPending && (
            <p className="mt-6 text-sm text-gray-500">Loading…</p>
          )}
          {options.isError && (
            <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              Could not reach the server. Please try again in a moment.
            </p>
          )}
          {data && !data.enabled && (
            <p className="mt-6 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
              Sign-up is closed on this workspace. Ask a team admin for access.
            </p>
          )}

          {data?.enabled && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Full name
                <input
                  required
                  maxLength={200}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
                />
              </label>

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
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  At least 8 characters.
                </span>
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Team
                <select
                  value={chosenTeam}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                >
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-gray-700">Role</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {data.roles.map((value) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 ${
                        role === value
                          ? "border-[#9db28a] bg-[#f7f9f3] ring-2 ring-[#dce8d1]"
                          : "border-[#e3e8dc] hover:border-[#cfdac4]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={role === value}
                        onChange={() => setRole(value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-gray-900">
                        {ROLE_INFO[value].label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-gray-500">
                        {ROLE_INFO[value].help}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !chosenTeam}
                className="w-full rounded-xl bg-[#304329] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#25351f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
