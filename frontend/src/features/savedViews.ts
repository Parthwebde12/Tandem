import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATES,
  WORK_ITEM_TYPES,
  type WorkItemPriority,
  type WorkItemState,
  type WorkItemType,
} from "../api/types";

export interface ItemFilters {
  q: string;
  teamId: string;
  state: WorkItemState | "";
  priority: WorkItemPriority | "";
  type: WorkItemType | "";
  mine: boolean;
  unassigned: boolean;
  overdue: boolean;
}

export interface SavedItemView {
  id: string;
  name: string;
  filters: ItemFilters;
  updatedAt: string;
}

const viewKey = (userId: string) => `opsdesk_saved_views_${userId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isItemFilters(value: unknown): value is ItemFilters {
  if (!isRecord(value)) return false;
  return (
    typeof value.q === "string" &&
    typeof value.teamId === "string" &&
    (value.state === "" || WORK_ITEM_STATES.includes(value.state as WorkItemState)) &&
    (value.priority === "" ||
      WORK_ITEM_PRIORITIES.includes(value.priority as WorkItemPriority)) &&
    (value.type === "" || WORK_ITEM_TYPES.includes(value.type as WorkItemType)) &&
    typeof value.mine === "boolean" &&
    typeof value.unassigned === "boolean" &&
    typeof value.overdue === "boolean"
  );
}

function isSavedItemView(value: unknown): value is SavedItemView {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.updatedAt === "string" &&
    isItemFilters(value.filters)
  );
}

export function loadSavedViews(userId: string): SavedItemView[] {
  const stored = localStorage.getItem(viewKey(userId));
  if (stored === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new Error("Saved views could not be read because browser storage is invalid.", {
      cause: error,
    });
  }
  if (!Array.isArray(parsed) || !parsed.every(isSavedItemView)) {
    throw new Error("Saved views have an invalid format. Clear the saved views to continue.");
  }
  return parsed;
}

export function saveItemView(
  userId: string,
  name: string,
  filters: ItemFilters,
): SavedItemView[] {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 50) {
    throw new Error("View names must be between 1 and 50 characters.");
  }

  const views = loadSavedViews(userId);
  const existing = views.find(
    (view) => view.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
  );
  const saved: SavedItemView = {
    id: existing?.id ?? crypto.randomUUID(),
    name: cleanName,
    filters: { ...filters },
    updatedAt: new Date().toISOString(),
  };
  const next = [
    saved,
    ...views.filter((view) => view.id !== saved.id),
  ];
  localStorage.setItem(viewKey(userId), JSON.stringify(next));
  return next;
}

export function deleteItemView(userId: string, viewId: string): SavedItemView[] {
  const next = loadSavedViews(userId).filter((view) => view.id !== viewId);
  localStorage.setItem(viewKey(userId), JSON.stringify(next));
  return next;
}

export function clearSavedViews(userId: string): void {
  localStorage.removeItem(viewKey(userId));
}
