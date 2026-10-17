export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  next_action: string;
  details: string | null;
  owner: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  next_action: string;
  details: string | null;
  owner: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}
