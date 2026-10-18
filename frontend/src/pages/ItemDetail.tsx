import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type { ItemComment, ItemEvent, Page, WorkItem } from "../api/types";
import { StateBadge } from "../components/WorkItemCard";
import { useAuth } from "../auth/useAuth";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function eventDescription(event: ItemEvent) {
  const labels: Record<ItemEvent["event_type"], string> = {
    created: "created this work item",
    claimed: "claimed this work item",
    released: "released this work item",
    assigned: "updated the assignment",
    priority_changed: "changed the priority",
    state_changed: "changed the status",
    edited: "edited this work item",
    commented: "added a comment",
    approval_requirement_changed: "changed the approval requirement",
  };
  return labels[event.event_type];
}

function EventChanges({ event }: { event: ItemEvent }) {
  if (!event.old_value && !event.new_value) return null;
  const keys = new Set([
    ...Object.keys(event.old_value ?? {}),
    ...Object.keys(event.new_value ?? {}),
  ]);
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      {[...keys].map((key) => (
        <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
          <dt className="font-semibold capitalize text-gray-500">{key.replaceAll("_", " ")}</dt>
          <dd className="mt-1 text-gray-800">
            {event.old_value?.[key] !== undefined && (
              <span>{displayValue(event.old_value[key])} <span className="text-gray-400">→</span> </span>
            )}
            {event.new_value?.[key] !== undefined && displayValue(event.new_value[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const itemQuery = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => apiFetch<WorkItem>(`/items/${itemId}`),
    enabled: Boolean(itemId),
  });
  const eventsQuery = useInfiniteQuery({
    queryKey: ["item-events", itemId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<Page<ItemEvent>>(`/items/${itemId}/events?${params.toString()}`);
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(itemId),
  });
  const commentsQuery = useInfiniteQuery({
    queryKey: ["item-comments", itemId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<Page<ItemComment>>(`/items/${itemId}/comments?${params.toString()}`);
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(itemId),
  });
  const addComment = useMutation({
    mutationFn: (body: string) =>
      apiFetch<ItemComment>(`/items/${itemId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: async () => {
      setComment("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item-comments", itemId] }),
        queryClient.invalidateQueries({ queryKey: ["item-events", itemId] }),
      ]);
    },
  });

  const item = itemQuery.data;
  const membership = user?.memberships.find((entry) => entry.team_id === item?.team_id);
  const canComment = membership?.role !== "viewer";
  const events = eventsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const comments = commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (body && !addComment.isPending) addComment.mutate(body);
  }

  if (itemQuery.isPending) {
    return <p className="rounded-2xl border border-[#e6e9df] bg-white p-8 text-sm text-gray-500">Loading work item…</p>;
  }
  if (itemQuery.isError || !item) {
    return (
      <div className="space-y-4">
        <Link to="/items" className="text-sm font-semibold text-[#49633b] hover:underline">← Back to work items</Link>
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {itemQuery.error instanceof ApiError
            ? itemQuery.error.message
            : "Could not load this work item. It may not exist or may not be available to your team."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/items" className="inline-flex text-sm font-semibold text-[#49633b] hover:underline">
        ← Back to work items
      </Link>

      <section className="rounded-3xl border border-[#e6e9df] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold capitalize text-[#66804f]">
              {item.type.replaceAll("_", " ")} · {item.priority} priority
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">{item.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {item.description || "No description provided."}
            </p>
          </div>
          <StateBadge state={item.state} />
        </div>
        <div className="mt-7 grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Owner</p>
            <p className="mt-1 text-sm font-medium text-gray-800">{item.owner?.full_name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Created by</p>
            <p className="mt-1 text-sm font-medium text-gray-800">{item.creator.full_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Next action</p>
            <p className="mt-1 text-sm font-medium text-gray-800">{item.next_action}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Due date</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {item.due_at ? formatDate(item.due_at) : "No due date"}
            </p>
          </div>
        </div>
        {item.requires_approval && (
          <p className="mt-5 inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800">
            Approval required
          </p>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Activity history</h2>
              <p className="mt-1 text-sm text-gray-500">An audit trail of changes to this item.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              {events.length} events
            </span>
          </div>
          {eventsQuery.isPending ? (
            <p className="mt-6 text-sm text-gray-500">Loading activity…</p>
          ) : eventsQuery.isError ? (
            <p role="alert" className="mt-6 text-sm text-red-700">Could not load activity history.</p>
          ) : events.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">No activity has been recorded yet.</p>
          ) : (
            <ol className="mt-6 space-y-5">
              {events.map((event) => (
                <li key={event.id} className="relative border-l border-gray-200 pl-5">
                  <span className="absolute -left-1.25 top-1 size-2 rounded-full bg-[#8ba36e]" />
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{event.actor.full_name}</span>{" "}
                    {eventDescription(event)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(event.created_at)}</p>
                  <EventChanges event={event} />
                </li>
              ))}
            </ol>
          )}
          {eventsQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void eventsQuery.fetchNextPage()}
              disabled={eventsQuery.isFetchingNextPage}
              className="mt-5 text-sm font-semibold text-[#49633b] hover:underline disabled:opacity-50"
            >
              {eventsQuery.isFetchingNextPage ? "Loading…" : "Load older activity"}
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Comments</h2>
            <p className="mt-1 text-sm text-gray-500">Keep the team in the loop.</p>
          </div>
          {canComment ? (
            <form onSubmit={submitComment} className="mt-5">
              <label htmlFor="item-comment" className="sr-only">Add a comment</label>
              <textarea
                id="item-comment"
                rows={3}
                maxLength={5000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Write an update…"
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm leading-5"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">{comment.length}/5000</span>
                <button
                  type="submit"
                  disabled={!comment.trim() || addComment.isPending}
                  className="rounded-xl bg-[#304329] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#25351f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addComment.isPending ? "Posting…" : "Post comment"}
                </button>
              </div>
              {addComment.isError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {addComment.error instanceof ApiError
                    ? addComment.error.message
                    : "Could not post your comment. Please try again."}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-5 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
              Viewers can read comments but cannot post.
            </p>
          )}

          {commentsQuery.isPending ? (
            <p className="mt-6 text-sm text-gray-500">Loading comments…</p>
          ) : commentsQuery.isError ? (
            <p role="alert" className="mt-6 text-sm text-red-700">Could not load comments.</p>
          ) : comments.length === 0 ? (
            <p className="mt-6 border-t border-gray-100 pt-5 text-sm text-gray-500">
              No comments yet. Start the conversation.
            </p>
          ) : (
            <ol className="mt-6 space-y-4 border-t border-gray-100 pt-5">
              {comments.map((entry) => (
                <li key={entry.id} className="rounded-xl bg-gray-50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">{entry.author.full_name}</span>
                    <time className="text-xs text-gray-400" dateTime={entry.created_at}>
                      {formatDate(entry.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-gray-700">{entry.body}</p>
                </li>
              ))}
            </ol>
          )}
          {commentsQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void commentsQuery.fetchNextPage()}
              disabled={commentsQuery.isFetchingNextPage}
              className="mt-4 text-sm font-semibold text-[#49633b] hover:underline disabled:opacity-50"
            >
              {commentsQuery.isFetchingNextPage ? "Loading…" : "Load older comments"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
