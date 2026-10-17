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