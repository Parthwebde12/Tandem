import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import type {
  CreateWorkItem,
  Membership,
  Page,
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "../api/types";
import CreateWorkItemDialog from "../components/CreateWorkItemDialog";
import WorkItemCard from "../components/WorkItemCard";
import { useAuth } from "../auth/useAuth";
import {
  clearSavedViews,
  deleteItemView,
  loadSavedViews,
  saveItemView,
  type ItemFilters,
  type SavedItemView,
} from "../features/savedViews";

const states: WorkItemState[] = [
  "open",
  "in_progress",
  "pending_approval",
  "resolved",
  "closed",
];
const priorities: WorkItemPriority[] = ["urgent", "high", "medium", "low"];
const types: WorkItemType[] = [
  "incident",
  "customer_issue",
  "payment",
  "compliance",
  "task",
];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function FilterSelect<T extends string>({
  label: fieldLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly T[];
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {fieldLabel}
      <select
        value={value}
        onChange={(event) => {
          const selected = event.target.value;
          onChange(selected === "" ? "" : options.find((option) => option === selected) ?? value);
        }}
        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildParams(filters: ItemFilters, cursor: string | null) {
  const params = new URLSearchParams({ limit: "25" });
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.teamId) params.set("team_id", filters.teamId);
  if (filters.state) params.set("state", filters.state);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.type) params.set("type", filters.type);
  if (filters.mine) params.set("mine", "true");
  if (filters.unassigned) params.set("unassigned", "true");
  if (filters.overdue) params.set("overdue", "true");
  if (cursor) params.set("cursor", cursor);
  return params;
}

export default function Items() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memberships: Membership[] = user?.memberships ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const userId = user?.id;
  const [savedViewState, setSavedViewState] = useState<{
    views: SavedItemView[];
    error: string | null;
  }>(() => {
    if (!userId) return { views: [], error: null };
    try {
      return { views: loadSavedViews(userId), error: null };
    } catch (error) {
      return {
        views: [],
        error: error instanceof Error ? error.message : "Could not read saved views.",
      };
    }
  });
  const [savedViewName, setSavedViewName] = useState("");
  const savedViews = savedViewState.views;
  const savedViewError = savedViewState.error;
  const [draft, setDraft] = useState<ItemFilters>({
    q: "",
    teamId: "",
    state: "",
    priority: "",
    type: "",
    mine: false,
    unassigned: false,
    overdue: false,
  });
  const [filters, setFilters] = useState(draft);
  const query = useInfiniteQuery({
    queryKey: ["items", filters],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = buildParams(filters, pageParam);
      return apiFetch<Page<WorkItem>>(`/items?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const createItem = useMutation({
    mutationFn: ({ teamId, payload }: { teamId: string; payload: CreateWorkItem }) =>
      apiFetch<WorkItem>(`/teams/${teamId}/items`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (item) => {
      setCreateOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      navigate(`/items/${item.id}`);
    },
  });
  const canCreate = memberships.some((membership) => membership.role !== "viewer");
  const loadNextPage = () => {
    void query.fetchNextPage();
  };

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ ...draft });
  }

  function clearFilters() {
    const empty: ItemFilters = {
      q: "",
      teamId: "",
      state: "",
      priority: "",
      type: "",
      mine: false,
      unassigned: false,
      overdue: false,
    };
    setDraft(empty);
    setFilters(empty);
  }

  function persistView(action: () => SavedItemView[]) {
    if (!userId) return false;
    try {
      setSavedViewState({ views: action(), error: null });
      return true;
    } catch (error) {
      setSavedViewState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Could not update saved views.",
      }));
      return false;
    }
  }

  function saveCurrentView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    if (persistView(() => saveItemView(userId, savedViewName, filters))) {
      setSavedViewName("");
    }
  }

  function applySavedView(view: SavedItemView) {
    setDraft({ ...view.filters });
    setFilters({ ...view.filters });
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#66804f]">
            Operations queue
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
            Work items
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Search and filter the work across your teams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200">
            {query.data ? `${items.length} shown` : "Team-scoped"}
          </span>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                createItem.reset();
                setCreateOpen(true);
              }}
              className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25351f]"
            >
              <span aria-hidden="true" className="mr-1.5">+</span>
              New item
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9df] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Saved views</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Keep your go-to queues handy on this device.
            </p>
          </div>
          {filtersHaveValues(filters) && (
            <form onSubmit={saveCurrentView} className="flex w-full gap-2 sm:w-auto">
              <label htmlFor="saved-view-name" className="sr-only">Name this view</label>
              <input
                id="saved-view-name"
                maxLength={50}
                required
                value={savedViewName}
                onChange={(event) => setSavedViewName(event.target.value)}
                placeholder="e.g. My urgent work"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm sm:w-48"
              />
              <button
                type="submit"
                disabled={Boolean(savedViewError)}
                className="shrink-0 rounded-xl border border-[#cfdac4] px-3 py-2 text-sm font-semibold text-[#49633b] transition hover:bg-[#edf2e4] disabled:opacity-50"
              >
                Save view
              </button>
            </form>
          )}
        </div>
        {savedViews.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <li
                key={view.id}
                className={`inline-flex items-center overflow-hidden rounded-xl border ${
                  filtersMatch(filters, view.filters)
                    ? "border-[#bfd0ae] bg-[#f2f6ec]"
                    : "border-gray-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => applySavedView(view)}
                  className="px-3 py-2 text-left text-sm font-medium text-gray-700 hover:text-[#304329]"
                  title={`Apply ${view.name}`}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (userId) {
                      persistView(() => deleteItemView(userId, view.id));
                    }
                  }}
                  aria-label={`Delete saved view ${view.name}`}
                  className="border-l border-inherit px-2 py-2 text-sm text-gray-400 hover:bg-rose-50 hover:text-rose-700"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : !savedViewError ? (
          <p className="mt-3 text-xs text-gray-400">
            Apply some filters to save your first view.
          </p>
        ) : null}
        {savedViewError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700">
            <span>{savedViewError}</span>
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                try {
                  clearSavedViews(userId);
                  setSavedViewState({ views: [], error: null });
                } catch {
                  setSavedViewState((current) => ({
                    ...current,
                    error: "Browser storage could not be cleared.",
                  }));
                }
              }}
              className="font-semibold underline"
            >
              Clear saved views
            </button>
          </div>
        )}
      </section>

      <form
        onSubmit={applyFilters}
        className="rounded-2xl border border-[#e6e9df] bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Search
            <input
              type="search"
              maxLength={200}
              value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              placeholder="Search titles and descriptions"
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </label>
          {memberships.length > 1 && (
            <label className="block text-sm font-medium text-gray-700">
              Team
              <select
                value={draft.teamId}
                onChange={(event) => setDraft({ ...draft, teamId: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All my teams</option>
                {memberships.map((membership) => (
                  <option key={membership.team_id} value={membership.team_id}>
                    {membership.team_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <FilterSelect
            label="Status"
            value={draft.state}
            onChange={(state) => setDraft({ ...draft, state })}
            options={states}
          />
          <FilterSelect
            label="Priority"
            value={draft.priority}
            onChange={(priority) => setDraft({ ...draft, priority })}
            options={priorities}
          />
          <FilterSelect
            label="Work type"
            value={draft.type}
            onChange={(type) => setDraft({ ...draft, type })}
            options={types}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {(
            [
              ["mine", "Assigned to me"],
              ["unassigned", "Unassigned"],
              ["overdue", "Overdue"],
            ] as const
          ).map(([key, checkboxLabel]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                className="size-4 rounded border-gray-300 accent-[#49633b]"
              />
              {checkboxLabel}
            </label>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#304329] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25351f]"
            >
              Apply filters
            </button>
          </div>
        </div>
      </form>

      {query.isPending ? (
        <p className="rounded-2xl border border-[#e6e9df] bg-white p-8 text-sm text-gray-500">
          Loading work items…
        </p>
      ) : query.isError ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {query.error instanceof ApiError
            ? query.error.message
            : "Could not load work items. Please try again."}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <h2 className="font-semibold text-gray-900">No work items found</h2>
          <p className="mt-2 text-sm text-gray-500">
            Try changing your filters or clearing the search.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {items.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
          {query.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                onClick={loadNextPage}
                disabled={query.isFetchingNextPage}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
          {query.isFetchNextPageError && (
            <p role="alert" className="text-center text-sm text-red-700">
              Could not load the next page.{" "}
              <button
                type="button"
                onClick={loadNextPage}
                className="font-semibold underline"
              >
                Try again
              </button>
            </p>
          )}
        </>
      )}
      {createOpen && (
        <CreateWorkItemDialog
          memberships={memberships.filter((membership) => membership.role !== "viewer")}
          pending={createItem.isPending}
          error={
            createItem.error instanceof ApiError
              ? createItem.error.message
              : createItem.isError
                ? "Could not create the item. Please try again."
                : null
          }
          onClose={() => setCreateOpen(false)}
          onCreate={(teamId, payload) => createItem.mutate({ teamId, payload })}
        />
      )}
    </div>
  );
}

function filtersHaveValues(filters: ItemFilters) {
  return Boolean(
    filters.q.trim() ||
      filters.teamId ||
      filters.state ||
      filters.priority ||
      filters.type ||
      filters.mine ||
      filters.unassigned ||
      filters.overdue,
  );
}

function filtersMatch(left: ItemFilters, right: ItemFilters) {
  return (
    left.q === right.q &&
    left.teamId === right.teamId &&
    left.state === right.state &&
    left.priority === right.priority &&
    left.type === right.type &&
    left.mine === right.mine &&
    left.unassigned === right.unassigned &&
    left.overdue === right.overdue
  );
}
