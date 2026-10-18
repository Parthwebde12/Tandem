import { useState, type FormEvent } from "react";
import type { CreateWorkItem, Membership, WorkItemPriority, WorkItemType } from "../api/types";

const types: WorkItemType[] = ["incident", "customer_issue", "payment", "compliance", "task"];
const priorities: WorkItemPriority[] = ["low", "medium", "high", "urgent"];

function toIsoDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function CreateWorkItemDialog({
  memberships,
  pending,
  error,
  onClose,
  onCreate,
}: {
  memberships: Membership[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (teamId: string, payload: CreateWorkItem) => void;
}) {
  const [teamId, setTeamId] = useState(memberships[0]?.team_id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nextAction, setNextAction] = useState("Needs triage");
  const [type, setType] = useState<WorkItemType>("task");
  const [priority, setPriority] = useState<WorkItemPriority>("medium");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [dueAt, setDueAt] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(teamId, {
      title: title.trim(),
      description: description.trim() || null,
      next_action: nextAction.trim(),
      type,
      priority,
      requires_approval: requiresApproval,
      due_at: toIsoDate(dueAt),
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#172014]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-item-heading"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#66804f]">
              New work
            </p>
            <h2 id="create-item-heading" className="mt-1 text-2xl font-bold text-gray-950">
              Create an item
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Give your team enough context to take the next step.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close form"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Team
            <select
              required
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
            >
              {memberships.map((membership) => (
                <option key={membership.team_id} value={membership.team_id}>
                  {membership.team_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Title
            <input
              required
              minLength={1}
              maxLength={300}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A short summary of the issue"
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Description <span className="font-normal text-gray-400">· optional</span>
            <textarea
              rows={4}
              maxLength={20_000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened? Add any details that will help."
              className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 leading-5"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Next action
            <input
              required
              minLength={1}
              maxLength={300}
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-gray-700">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as WorkItemType)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              >
                {types.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as WorkItemPriority)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Due date <span className="font-normal text-gray-400">· optional</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-950">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
              className="mt-0.5 size-4 rounded accent-violet-700"
            />
            <span>
              <span className="block font-semibold">Requires manager approval</span>
              <span className="mt-0.5 block text-xs text-violet-800">
                The owner will need a manager to approve resolution.
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !teamId}
              className="rounded-xl bg-[#304329] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#25351f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create work item"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
