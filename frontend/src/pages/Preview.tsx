import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const capabilities = [
  {
    number: "01",
    title: "See the whole queue",
    description:
      "Find team work by status, priority, type, owner, and due date. Search when you need a specific item.",
  },
  {
    number: "02",
    title: "Make ownership clear",
    description:
      "Claim an open item or assign it to a teammate. Changes are checked against the latest version.",
  },
  {
    number: "03",
    title: "Keep a useful history",
    description:
      "Follow comments and status changes in one place, with the people and updates attached to the work.",
  },
];

export default function Preview() {
  const { user, isLoading } = useAuth();
  const workspacePath = user ? "/workspace" : "/login";

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-[#20251c]">
      <header className="border-b border-[#e4e8dc] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Tandem preview">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#25351f] text-lg font-bold text-lime-200">
              T
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">Tandem</span>
              <span className="hidden text-xs text-gray-500 sm:block">
                Operations workspace
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-[#edf2e4] px-3 py-1 text-xs font-semibold text-[#49633b] sm:inline-flex">
              Product preview
            </span>
            <Link
              to={workspacePath}
              className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25351f]"
            >
              {isLoading ? "Loading…" : user ? "Open workspace" : "Sign in"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#dfe6d5] bg-white px-3 py-1.5 text-xs font-semibold text-[#49633b]">
              <span className="size-1.5 rounded-full bg-[#769457]" />
              A clearer way to move team work forward
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-[#20251c] sm:text-6xl">
              Good work starts with a{" "}
              <span className="text-[#637b4d]">clear next step.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
              Tandem brings incidents, customer issues, payments, and everyday
              tasks into one team workspace—so everyone knows what needs doing
              and who’s moving it along.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={workspacePath}
                className="rounded-xl bg-[#304329] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#25351f]"
              >
                {user ? "Go to your workspace" : "Sign in to explore"}
                <span aria-hidden="true" className="ml-2">→</span>
              </Link>
              <span className="text-sm text-gray-500">
                Team access stays private to its members.
              </span>
            </div>
          </div>

          <div
            aria-label="Illustration of the Tandem work queue"
            className="relative rounded-[1.75rem] border border-[#e3e8dc] bg-white p-4 shadow-[0_24px_70px_-40px_rgba(37,53,31,0.45)] sm:p-6"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#718363]">
                  Team workspace
                </p>
                <p className="mt-1 text-lg font-bold text-gray-950">Work at a glance</p>
              </div>
              <span className="rounded-full bg-[#edf2e4] px-3 py-1 text-xs font-semibold text-[#49633b]">
                Preview
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 py-4 sm:gap-3">
              {[
                { label: "Open", tone: "bg-sky-50 text-sky-800" },
                { label: "In progress", tone: "bg-amber-50 text-amber-800" },
                { label: "Needs review", tone: "bg-violet-50 text-violet-800" },
              ].map((status) => (
                <div key={status.label} className="rounded-xl bg-gray-50 p-3 sm:p-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs ${status.tone}`}>
                    {status.label}
                  </span>
                  <div className="mt-3 h-2 w-10 rounded bg-gray-200" />
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              {[
                { kind: "INCIDENT", title: "A clear owner for every issue", priority: "Urgent", color: "bg-rose-50 text-rose-700" },
                { kind: "CUSTOMER ISSUE", title: "Updates that stay with the work", priority: "High", color: "bg-amber-50 text-amber-700" },
                { kind: "TEAM TASK", title: "A visible next step, not another handoff", priority: "Normal", color: "bg-gray-100 text-gray-600" },
              ].map((row) => (
                <div
                  key={row.kind}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3 sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#edf2e4] text-xs font-bold text-[#49633b]">
                      {row.kind.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-800">
                        {row.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold tracking-wide text-gray-400">
                        {row.kind}
                      </span>
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${row.color}`}>
                    {row.priority}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-gray-400">
              Illustrative preview · sign in to view your team’s data
            </p>
          </div>
        </section>

        <section className="mt-16 border-t border-[#e2e7da] pt-10 sm:mt-20 sm:pt-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#718363]">
              Built for the work between teams
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
              Less chasing. More moving forward.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.number}
                className="rounded-2xl border border-[#e3e8dc] bg-white p-5 sm:p-6"
              >
                <span className="text-xs font-bold tracking-[0.12em] text-[#839673]">
                  {capability.number}
                </span>
                <h3 className="mt-4 font-semibold text-gray-950">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{capability.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e4e8dc] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-gray-500 sm:px-8">
          <span>Tandem · Internal operations workspace</span>
          <Link to={workspacePath} className="font-semibold text-[#49633b] hover:underline">
            {user ? "Open workspace" : "Team member? Sign in"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
