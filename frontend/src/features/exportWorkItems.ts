import type { WorkItem } from "../api/types";

const columns: Array<[string, (item: WorkItem) => string]> = [
  ["id", (item) => item.id],
  ["title", (item) => item.title],
  ["type", (item) => item.type],
  ["state", (item) => item.state],
  ["priority", (item) => item.priority],
  ["team id", (item) => item.team_id],
  ["owner", (item) => item.owner?.full_name ?? ""],
  ["owner id", (item) => item.owner?.id ?? ""],
  ["creator", (item) => item.creator.full_name],
  ["creator id", (item) => item.creator.id],
  ["next action", (item) => item.next_action],
  ["description", (item) => item.description ?? ""],
  ["due at", (item) => item.due_at ?? ""],
  ["requires approval", (item) => (item.requires_approval ? "yes" : "no")],
  ["version", (item) => String(item.version)],
  ["created at", (item) => item.created_at],
  ["updated at", (item) => item.updated_at],
];

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function exportWorkItems(items: readonly WorkItem[]): void {
  const rows = [
    columns.map(([heading]) => heading),
    ...items.map((item) => columns.map(([, getValue]) => getValue(item))),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `opsdesk-work-items-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
