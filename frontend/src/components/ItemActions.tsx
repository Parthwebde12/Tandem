import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../api/client";
import type {
  Membership,
  Page,
  TeamMember,
  WorkItem,
  WorkItemPriority,
  WorkItemState,
} from "../api/types";
import { useAuth } from "../auth/useAuth";

interface ItemChange {
  path: string;
  method: "PATCH" | "POST";
  body: Record<string, unknown>;
}

interface ClaimContext {
  previousItem: WorkItem | undefined;
  previousLists: [readonly unknown[], InfiniteData<Page<WorkItem>, string | null> | undefined][];
}

const priorities: WorkItemPriority[] = ["low", "medium", "high", "urgent"];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm";

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIsoDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function transitionChoices(
  item: WorkItem,
  userId: string,
  membership: Membership | undefined,
) {
  if (!membership || membership.role === "viewer") return [];
  const manager = membership.role === "manager" || membership.role === "admin";
  const choices: { state: WorkItemState; label: string; needsComment?: boolean }[] = [];

  if (item.state === "in_progress" && item.owner?.id === userId) {
    choices.push(
      item.requires_approval
        ? { state: "pending_approval", label: "Submit for approval" }
        : { state: "resolved", label: "Mark resolved" },
    );
  }
  if (
    item.state === "pending_approval" &&
    manager &&
    item.owner?.id !== userId &&
    item.creator.id !== userId
  ) {
    choices.push(
      { state: "resolved", label: "Approve and resolve" },
      { state: "in_progress", label: "Reject and return", needsComment: true },
    );
  }
  if (item.state === "resolved") {
    if (manager) choices.push({ state: "closed", label: "Close item" });
    choices.push({ state: "in_progress", label: "Reopen item", needsComment: true });
  }
  return choices;
}

export default function ItemActions({
  item,
  membership,
}: {
  item: WorkItem;
  membership: Membership | undefined;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [nextAction, setNextAction] = useState(item.next_action);
  const [priority, setPriority] = useState(item.priority);
  const [requiresApproval, setRequiresApproval] = useState(item.requires_approval);
  const [dueAt, setDueAt] = useState(toLocalDateTime(item.due_at));
  const [assigneeId, setAssigneeId] = useState("");
  const [nextState, setNextState] = useState<WorkItemState | "">("");
  const [transitionComment, setTransitionComment] = useState("");
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  const isManager = membership?.role === "manager" || membership?.role === "admin";
  const canCommentOrClaim = membership !== undefined && membership.role !== "viewer";
  const canEdit =
    item.state !== "closed" &&
    (isManager || item.owner?.id === user?.id);
  const transitionOptions = user
    ? transitionChoices(item, user.id, membership)
    : [];
  const chosenTransition = transitionOptions.find((choice) => choice.state === nextState);

  const membersQuery = useQuery({
    queryKey: ["team-members", item.team_id],
    queryFn: () => apiFetch<TeamMember[]>(`/teams/${item.team_id}/members`),
    enabled: Boolean(isManager && (item.state === "open" || item.state === "in_progress")),
  });

  function setItemCaches(updated: WorkItem) {
    queryClient.setQueryData(["item", item.id], updated);
    queryClient.setQueriesData<InfiniteData<Page<WorkItem>, string | null>>(
      { queryKey: ["items"] },
      (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((entry) => (entry.id === updated.id ? updated : entry)),
              })),
            }
          : current,
    );
  }

  async function refreshItemViews() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["item", item.id] }),
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["item-events", item.id] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  const changeItem = useMutation<WorkItem, Error, ItemChange>({
    mutationFn: ({ path, method, body }) =>
      apiFetch<WorkItem>(path, { method, body: JSON.stringify(body) }),
    onSuccess: async (updated) => {
      setItemCaches(updated);
      setEditing(false);
      setNextState("");
      setTransitionComment("");
      await refreshItemViews();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.currentItem) {
        setItemCaches(error.currentItem);
        await refreshItemViews();
      }
    },
  });

  const claimItem = useMutation<WorkItem, Error, void, ClaimContext>({
    mutationFn: () =>
      apiFetch<WorkItem>(`/items/${item.id}/claim`, { method: "POST" }),
    onMutate: async () => {
      setClaimNotice(null);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["item", item.id] }),
        queryClient.cancelQueries({ queryKey: ["items"] }),
      ]);
      const previousItem = queryClient.getQueryData<WorkItem>(["item", item.id]);
      const previousLists = queryClient.getQueriesData<
        InfiniteData<Page<WorkItem>, string | null>
      >({ queryKey: ["items"] });
      const optimistic: WorkItem = {
        ...item,
        state: "in_progress",
        owner: user ? { id: user.id, full_name: user.full_name } : item.owner,
        version: item.version + 1,
        updated_at: new Date().toISOString(),
      };
      setItemCaches(optimistic);
      return { previousItem, previousLists };
    },
    onError: async (error, _variables, context) => {
      if (error instanceof ApiError && error.status === 409 && error.currentItem) {
        setItemCaches(error.currentItem);
        setClaimNotice("Someone else claimed this item first. The latest status is shown.");
        await refreshItemViews();
        return;
      }
      if (context?.previousItem) {
        queryClient.setQueryData(["item", item.id], context.previousItem);
      }
      context?.previousLists.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
      setClaimNotice(
        error instanceof ApiError
          ? error.message
          : "Could not claim the item. Please try again.",
      );
    },
    onSuccess: async (updated) => {
      setItemCaches(updated);
      await refreshItemViews();
    },
  });

  const writeError =
    changeItem.error instanceof ApiError
      ? changeItem.error.message
      : changeItem.isError
        ? "That change could not be saved. Please try again."
        : null;

  function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changeItem.mutate({
      path: `/items/${item.id}`,
      method: "PATCH",
      body: {
        version: item.version,
        title: title.trim(),
        description: description.trim() || null,
        next_action: nextAction.trim(),
        priority,
        ...(isManager ? { requires_approval: requiresApproval } : {}),
        due_at: toIsoDate(dueAt),
      },
    });
  }

  function assignItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assigneeId) return;
    changeItem.mutate({
      path: `/items/${item.id}/assign`,
      method: "POST",
      body: { version: item.version, assignee_id: assigneeId },
    });
  }

  function releaseItem() {
    changeItem.mutate({
      path: `/items/${item.id}/release`,
      method: "POST",
      body: { version: item.version },
    });
  }

  function transitionItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosenTransition) return;
    changeItem.mutate({
      path: `/items/${item.id}/transition`,
      method: "POST",
      body: {
        version: item.version,
        to_state: chosenTransition.state,
        comment: transitionComment.trim() || null,
      },
    });
  }

  return (
    <section className="rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-950">Item actions</h2>
          <p className="mt-1 text-sm text-gray-500">Your role determines which changes are available.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setTitle(item.title);
              setDescription(item.description ?? "");
              setNextAction(item.next_action);
              setPriority(item.priority);
              setRequiresApproval(item.requires_approval);
              setDueAt(toLocalDateTime(item.due_at));
              changeItem.reset();
              setEditing((value) => !value);
            }}
            className="rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {editing ? "Cancel edit" : "Edit details"}
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {canCommentOrClaim && item.state === "open" && item.owner === null && (
          <button
            type="button"
            onClick={() => claimItem.mutate()}
            disabled={claimItem.isPending}
            className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25351f] disabled:opacity-50"
          >
            {claimItem.isPending ? "Claiming…" : "Claim this item"}
          </button>
        )}
        {isManager && (item.state === "open" || item.state === "in_progress") && (
          <form onSubmit={assignItem} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="assign-member">Assign to a team member</label>
            <select
              id="assign-member"
              required
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              disabled={membersQuery.isPending || membersQuery.isError}
              className="max-w-56 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Assign to…</option>
              {membersQuery.data
                ?.filter((member) => member.role !== "viewer")
                .map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={!assigneeId || changeItem.isPending || membersQuery.isPending}
              className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {membersQuery.isPending ? "Loading team…" : "Assign"}
            </button>
            {membersQuery.isError && (
              <span role="alert" className="text-xs text-rose-700">Could not load team members.</span>
            )}
          </form>
        )}
        {canCommentOrClaim &&
          item.state === "in_progress" &&
          (item.owner?.id === user?.id || isManager) && (
            <button
              type="button"
              onClick={releaseItem}
              disabled={changeItem.isPending}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Release item
            </button>
          )}
      </div>

      {claimNotice && (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          {claimNotice}
        </p>
      )}
      {claimItem.isError && !claimNotice && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {claimItem.error.message}
        </p>
      )}

      {transitionOptions.length > 0 && (
        <form onSubmit={transitionItem} className="mt-5 border-t border-gray-100 pt-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <label className="block text-sm font-medium text-gray-700">
              Change status
              <select
                required
                value={nextState}
                onChange={(event) => setNextState(event.target.value as WorkItemState | "")}
                className={inputClass}
              >
                <option value="">Choose an action…</option>
                {transitionOptions.map((choice) => (
                  <option key={choice.state} value={choice.state}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            {chosenTransition?.needsComment ? (
              <label className="block text-sm font-medium text-gray-700">
                Comment required
                <input
                  required
                  maxLength={5000}
                  value={transitionComment}
                  onChange={(event) => setTransitionComment(event.target.value)}
                  placeholder="Add a note for the activity history"
                  className={inputClass}
                />
              </label>
            ) : (
              <p className="pb-2 text-xs text-gray-500">
                Status changes are recorded in the activity history.
              </p>
            )}
            <button
              type="submit"
              disabled={!chosenTransition || changeItem.isPending}
              className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25351f] disabled:opacity-50"
            >
              {changeItem.isPending ? "Saving…" : "Update status"}
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form onSubmit={saveEdits} className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Title
              <input
                required
                maxLength={300}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Description
              <textarea
                rows={3}
                maxLength={20_000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Next action
              <input
                required
                maxLength={300}
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as WorkItemPriority)}
                className={inputClass}
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            {isManager && (
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(event) => setRequiresApproval(event.target.checked)}
                  className="size-4 rounded accent-[#49633b]"
                />
                Requires manager approval
              </label>
            )}
            <label className="block text-sm font-medium text-gray-700">
              Due date
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {writeError && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              {writeError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={changeItem.isPending}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeItem.isPending}
              className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#25351f] disabled:opacity-50"
            >
              {changeItem.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {writeError && !editing && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          {writeError}
        </p>
      )}
    </section>
  );
}
