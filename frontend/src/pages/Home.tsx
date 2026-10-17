import { useAuth } from "../auth/useAuth";

export default function Home() {
  const { user } = useAuth();
  const memberships = user?.memberships ?? [];

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-800">
          Workspace overview
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
          Welcome, {user?.full_name}
        </h1>
        <p className="mt-2 text-gray-600">
          You have access to {memberships.length}{" "}
          {memberships.length === 1 ? "team" : "teams"}.
        </p>
      </div>

      <section aria-labelledby="teams-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="teams-heading" className="text-xl font-semibold text-gray-950">
              Your teams
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Team access is based on your membership.
                    </p>
          </div>
          <span className="rounded-full bg-lime-100 px-3 py-1 text-sm font-semibold text-lime-900">
            {memberships.length}
          </span>
        </div>

        {memberships.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {memberships.map((membership) => (
              <li
                key={membership.team_id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-lime-100 text-lg font-bold text-lime-900"
                    >
                      {membership.team_name.slice(0, 1).toUpperCase()}
                    </span>
                    <h3 className="truncate text-lg font-semibold text-gray-950">
                      {membership.team_name}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">
                    {membership.role}
                  </span>
                </div>
                <p className="mt-5 text-sm text-gray-500">Your team role</p>
                <p className="mt-1 text-sm font-medium capitalize text-gray-800">
                  {membership.role}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <h3 className="font-semibold text-gray-900">No teams yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              You do not have a team membership yet. Ask an OpsDesk
              administrator to add you to a team.
            </p>
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-lime-200 bg-lime-50 p-5">
        <h2 className="font-semibold text-gray-950">Work items are coming next</h2>
        <p className="mt-1 text-sm text-gray-700">
          Team dashboards will show operational work once the work-item API is
          available.
        </p>
      </aside>
    </section>
  );
}