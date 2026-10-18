export type TeamRole = "viewer" | "member" | "manager" | "admin";
export const WORK_ITEM_TYPES = [
  "incident",
  "customer_issue",
  "payment",
  "compliance",
  "task",
] as const;
export const WORK_ITEM_STATES = [
  "open",
  "in_progress",
  "pending_approval",
  "resolved",
  "closed",
] as const;
export const WORK_ITEM_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];
export type WorkItemState = (typeof WORK_ITEM_STATES)[number];
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];
export interface Membership {
  team_id: string;
  team_name: string;
  role: TeamRole;
}

export interface Me {
  id: string;
  email: string;
  full_name: string;
  memberships: Membership[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface WorkItem {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  next_action: string;
  type: WorkItemType;
  state: WorkItemState;
  priority: WorkItemPriority;
  owner: UserBrief | null;
  creator: UserBrief;
  requires_approval: boolean;
  version: number;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkItem {
  title: string;
  description: string | null;
  next_action: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  requires_approval: boolean;
  due_at: string | null;
}

export interface UserBrief {
  id: string;
  full_name: string;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface ItemEvent {
  id: string;
  actor: UserBrief;
  event_type:
    | "created"
    | "claimed"
    | "released"
    | "assigned"
    | "priority_changed"
    | "state_changed"
    | "edited"
    | "commented"
    | "approval_requirement_changed";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface ItemComment {
  id: string;
  author: UserBrief;
  body: string;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: TeamRole;
}

export interface Notification {
  id: string;
  kind: string;
  message: string;
  work_item_id: string;
  created_at: string;
  read_at: string | null;
}

export interface DashboardBucket {
  total: number;
  items: WorkItem[];
}

export interface Dashboard {
  counts_by_state: Record<WorkItemState, number>;
  overdue_mine: DashboardBucket;
  urgent_mine: DashboardBucket;
  awaiting_my_approval: DashboardBucket;
  unclaimed_urgent: DashboardBucket;
}