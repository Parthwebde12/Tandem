import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskInput, TaskPriority, TaskStatus } from "./api/types";
import "./App.css";

const statusLabels: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const emptyForm: TaskInput = {
  title: "",
  next_action: "",
  details: null,
  owner: null,
  status: "open",
  priority: "normal",
  due_date: null,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string | { msg?: string }[] }
      | null;
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((entry) => entry.msg).filter(Boolean).join("; ")
      : detail;
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function TaskForm({
  onCreate,
  isSaving,
}: {
  onCreate: (task: TaskInput) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TaskInput>(emptyForm);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onCreate(form)
      .then(() => setForm(emptyForm))
      .catch(() => undefined);
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <div className="form-heading">
        <span className="eyebrow">CAPTURE THE HANDOFF</span>
        <h2>What needs doing?</h2>
      </div>
      <label>
        Task
        <input
          required
          maxLength={200}
          placeholder="e.g. Prepare the release notes"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label>
        Next action
        <input
          required
          maxLength={300}
          placeholder="The very next concrete step"
          value={form.next_action}
          onChange={(event) =>
            setForm({ ...form, next_action: event.target.value })
          }
        />
      </label>
      <label>
        Details <span className="optional">optional</span>
        <textarea
          rows={2}
          placeholder="Useful context for the teammate picking this up"
          value={form.details ?? ""}
          onChange={(event) =>
            setForm({ ...form, details: event.target.value || null })
          }
        />
      </label>
      <div className="form-row">
        <label>
          Owner <span className="optional">optional</span>
          <input
            maxLength={120}
            placeholder="Name"
            value={form.owner ?? ""}
            onChange={(event) =>
              setForm({ ...form, owner: event.target.value || null })
            }
          />
        </label>
        <label>
          Due date <span className="optional">optional</span>
          <input
            type="date"
            value={form.due_date ?? ""}
            onChange={(event) =>
              setForm({ ...form, due_date: event.target.value || null })
            }
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Priority
          <select
            value={form.priority}
            onChange={(event) =>
              setForm({
                ...form,
                priority: event.target.value as TaskPriority,
              })
            }
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as TaskStatus })
            }
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-button" disabled={isSaving} type="submit">
        {isSaving ? "Adding..." : "Add to board"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
  isSaving,
}: {
  task: Task;
  onUpdate: (id: string, changes: Partial<TaskInput>) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}) {
  return (
    <article className={`task-card priority-${task.priority}`}>
      <div className="card-topline">
        <span className={`priority-pill priority-pill-${task.priority}`}>
          <span className="priority-dot" />
          {priorityLabels[task.priority]}
        </span>
        <button
          className="delete-button"
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={() => onDelete(task.id)}
          disabled={isSaving}
        >
          ×
        </button>
      </div>
      <h3>{task.title}</h3>
      {task.details && <p className="task-details">{task.details}</p>}
      <div className="next-action">
        <span className="next-action-icon" aria-hidden="true">
          ↳
        </span>
        <div>
          <span className="eyebrow">NEXT ACTION</span>
          <p>{task.next_action}</p>
        </div>
      </div>
      <div className="card-footer">
        <span className="owner-label">
          <span className="avatar" aria-hidden="true">
            {task.owner?.trim().charAt(0).toUpperCase() || "·"}
          </span>
          {task.owner || "Unassigned"}
        </span>
        {task.due_date && (
          <span className="due-date">
            Due{" "}
            {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
        )}
      </div>
      <label className="status-control">
        <span className="sr-only">Status for {task.title}</span>
        <select
          value={task.status}
          disabled={isSaving}
          onChange={(event) =>
            onUpdate(task.id, { status: event.target.value as TaskStatus })
          }
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [boardError, setBoardError] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      return request<Task[]>(`/tasks?${params.toString()}`);
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["tasks", "summary"],
    queryFn: () => request<Task[]>("/tasks?limit=100"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TaskInput) =>
      request<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setBoardError("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => setBoardError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<TaskInput> }) =>
      request<Task>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      }),
    onSuccess: () => {
      setBoardError("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => setBoardError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      request<void>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setBoardError("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => setBoardError(error.message),
  });

  const counts = useMemo(() => {
    const tasks = summaryQuery.data ?? [];
    return {
      total: tasks.length,
      open: tasks.filter((task) => task.status === "open").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      done: tasks.filter((task) => task.status === "done").length,
    };
  }, [summaryQuery.data]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OpsDesk home">
          <span className="brand-mark" aria-hidden="true">
            o
          </span>
          opsdesk<span className="brand-period">.</span>
        </a>
        <span className="team-indicator">
          <span className="online-dot" />
          ONE TEAM · SHARED BOARD
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">THE TEAM WORKSPACE</span>
          <h1>
            Make the next
            <br />
            move <span>obvious.</span>
          </h1>
          <p>
            One calm place for what needs doing, who owns it, and the very next
            step.
          </p>
        </div>
        <div className="hero-stats" aria-label="Task summary">
          <div>
            <strong>{counts.total}</strong>
            <span>ON THE BOARD</span>
          </div>
          <div>
            <strong>{counts.inProgress}</strong>
            <span>IN MOTION</span>
          </div>
          <div>
            <strong>{counts.done}</strong>
            <span>COMPLETED</span>
          </div>
        </div>
      </section>

      <section className="workspace" aria-label="Task board">
        <TaskForm
          onCreate={(payload) => createMutation.mutateAsync(payload)}
          isSaving={createMutation.isPending}
        />

        <div className="board">
          <div className="board-heading">
            <div>
              <span className="eyebrow">THE SHARED LIST</span>
              <h2>Team board</h2>
            </div>
            <span className="task-count">
              {(tasksQuery.data?.length ?? 0).toString().padStart(2, "0")} TASKS
            </span>
          </div>

          <div className="board-tools">
            <div className="filter-tabs" aria-label="Filter tasks by status">
              {(
                [
                  ["all", "All"],
                  ["open", "Open"],
                  ["in_progress", "In progress"],
                  ["done", "Done"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={statusFilter === value ? "filter-active" : ""}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                maxLength={100}
                placeholder="Find a task..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {boardError && (
            <p className="error-message" role="alert">
              {boardError}
            </p>
          )}

          {tasksQuery.isLoading ? (
            <p className="board-message">Loading the board...</p>
          ) : tasksQuery.isError ? (
            <div className="board-message error-message" role="alert">
              Couldn’t load the board: {tasksQuery.error.message}
              <button
                type="button"
                className="text-button"
                onClick={() => void tasksQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : tasksQuery.data?.length ? (
            <div className="task-grid">
              {tasksQuery.data.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={(id, changes) =>
                    updateMutation.mutate({ id, changes })
                  }
                  onDelete={(id) => {
                    if (window.confirm(`Delete "${task.title}"?`)) {
                      deleteMutation.mutate(id);
                    }
                  }}
                  isSaving={
                    updateMutation.isPending || deleteMutation.isPending
                  }
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">✳</span>
              <h3>{search ? "No matching tasks" : "A fresh start."}</h3>
              <p>
                {search
                  ? "Try another search or clear your filter."
                  : "Add the first task. Make its next step clear."}
              </p>
            </div>
          )}
          <footer className="board-footer">
            <span>
              {counts.open} open <span aria-hidden="true">·</span>{" "}
              {counts.inProgress} in progress <span aria-hidden="true">·</span>{" "}
              {counts.done} done
            </span>
            <span>SMALL STEPS, CLEAR HANDOFFS.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
