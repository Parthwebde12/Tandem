import { Link } from "react-router-dom";
import type { WorkItem, WorkItemPriority, WorkItemState } from "../api/types";

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

const priorityStyles: Record<WorkItemPriority, string> = {
  low: "text-gray-500",
  medium: "text-sky-700",
  high: "text-amber-700",
  urgent: "text-rose-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function StateBadge({ state }: { state: WorkItemState }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateStyles[state]}`}>
      {stateLabels[state]}
    </span>
  );
}

export default function WorkItemCard({ item }: { item: WorkItem }) {
  return (
    <article className="group rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#cbd7bd] hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/items/${item.id}`}
            className="text-base font-semibold text-gray-950 hover:text-[#49633b]"
          >
            {item.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
            {item.description || item.next_action}
          </p>
        </div>
        <StateBadge state={item.state} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-500">
          <span className="capitalize">{item.type.replaceAll("_", " ")}</span>
          <span className={`font-bold uppercase tracking-wide ${priorityStyles[item.priority]}`}>
            {item.priority}
          </span>
          <span>{item.owner?.full_name ?? "Unassigned"}</span>
        </div>
        <span className="text-gray-400">
          {item.due_at ? `Due ${formatDate(item.due_at)}` : `Updated ${formatDate(item.updated_at)}`}
        </span>
      </div>
    </article>
  );
}
