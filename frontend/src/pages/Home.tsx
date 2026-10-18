import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { Dashboard, DashboardBucket, WorkItemState } from "../api/types";
import { useAuth } from "../auth/useAuth";

const stateLabels: Record<WorkItemState, string> = {
  open: "Open",
  in_progress: "In progress",
  pending_approval: "Pending approval",
  resolved: "Resolved",
  closed: "Closed",
};

const stateStyles: Record<WorkItemState, string> = {
  open: "bg-sky-50 text-sky-800",
  in_progress: "bg-amber-50 text-amber-800",
  pending_approval: "bg-violet-50 text-violet-800",
  resolved: "bg-emerald-50 text-emerald-800",
  closed: "bg-gray-100 text-gray-700",
};

function DashboardPanel({
  title,
  description,
  bucket,
  accent,
}: {
  title: string;
  description: string;
  bucket: DashboardBucket;
  accent: string;
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-950">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${accent}`}>
          {bucket.total}
        </span>
      </div>
      {bucket.items.length > 0 ? (
        <ul className="mt-5 divide-y divide-gray-100">
          {bucket.items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <Link
                to={`/items/${item.id}`}
                className="group flex items-start justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-800 group-hover:text-[#49633b]">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs capitalize text-gray-500">
                    {item.type.replaceAll("_", " ")} · {item.owner?.full_name ?? "Unassigned"}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${stateStyles[item.state]}`}
                >
                  {stateLabels[item.state]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
          Nothing needs attention here.
        </p>
      )}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<Dashboard>("/dashboard"),
  });
  const dashboard = dashboardQuery.data;
  const states = Object.keys(stateLabels) as WorkItemState[];
  const teamCount = user?.memberships.length ?? 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-[#25351f] px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200">
            Operations overview
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Good to see you, {user?.full_name.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#d5dfce] sm:text-base">
            Keep your teams moving. Review active work, spot urgent items, and
            follow every update from one place.
          </p>
          <Link
            to="/items"
            className="mt-6 inline-flex items-center rounded-xl bg-lime-200 px-4 py-2.5 text-sm font-bold text-[#25351f] transition hover:bg-lime-100"
          >
            Browse work items <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {dashboardQuery.isPending ? (
        <div className="rounded-2xl border border-[#e6e9df] bg-white p-8 text-sm text-gray-500">
          Loading your operations overview…
        </div>
      ) : dashboardQuery.isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {dashboardQuery.error instanceof ApiError
            ? dashboardQuery.error.message
            : "Could not load the dashboard. Please try again."}
        </div>
      ) : dashboard ? (
        <>
          <section aria-labelledby="workload-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 id="workload-heading" className="text-lg font-bold text-gray-950">
                  Workload at a glance
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Across your {teamCount} {teamCount === 1 ? "team" : "teams"}
                </p>
              </div>
              <Link to="/items" className="text-sm font-semibold text-[#49633b] hover:underline">
                View all items
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {states.map((state) => (
                <div
                  key={state}
                  className="rounded-2xl border border-[#e6e9df] bg-white p-4 shadow-sm sm:p-5"
                >
                  <p className="text-sm font-medium text-gray-500">{stateLabels[state]}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
                    {dashboard.counts_by_state[state] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="attention-heading">
            <div className="mb-4">
              <h2 id="attention-heading" className="text-lg font-bold text-gray-950">
                Needs your attention
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Priority queues based on your team access and responsibilities.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DashboardPanel
                title="Overdue and assigned to you"
                description="Open work past its due date"
                bucket={dashboard.overdue_mine}
                accent="bg-rose-50 text-rose-800"
              />
              <DashboardPanel
                title="Urgent work assigned to you"
                description="Urgent items you own"
                bucket={dashboard.urgent_mine}
                accent="bg-amber-50 text-amber-800"
              />
              <DashboardPanel
                title="Awaiting your approval"
                description="Items ready for a manager decision"
                bucket={dashboard.awaiting_my_approval}
                accent="bg-violet-50 text-violet-800"
              />
              <DashboardPanel
                title="Unclaimed urgent work"
                description="Urgent items without an owner"
                bucket={dashboard.unclaimed_urgent}
                accent="bg-orange-50 text-orange-800"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e6e9df] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-950">Your team access</h2>
                <p className="mt-1 text-sm text-gray-500">
                  You belong to {teamCount} {teamCount === 1 ? "team" : "teams"}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {user?.memberships.map((membership) => (
                  <span
                    key={membership.team_id}
                    className="rounded-full bg-[#edf2e4] px-3 py-1.5 text-sm font-medium text-[#34482c]"
                  >
                    {membership.team_name}
                    <span className="ml-2 text-xs capitalize text-[#64745a]">
                      {membership.role}
                    </span>
                  </span>
                ))}
                {teamCount === 0 && (
                  <span className="text-sm text-gray-500">
                    Ask an administrator to add you to a team.
                  </span>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

    </div>
  );
}
