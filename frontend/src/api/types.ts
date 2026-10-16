export type TeamRole = "viewer" | "member" | "manager" | "admin";
export type WorkItemType =
  | "incident"
  | "customer_issue"
  | "payment"
  | "compliance"
  | "task";
export type WorkItemState =
  | "open"
  | "in_progress"
  | "pending_approval"
  | "resolved"
  | "closed";
export type WorkItemPriority = "low" | "medium" | "high" | "urgent";