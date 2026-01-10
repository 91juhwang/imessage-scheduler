export type DashboardMessage = {
  id: string;
  scheduled_for_utc: string;
  to_handle: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  delivered_at: string | null;
  received_at: string | null;
  body: string | null;
  receipt_correlation: Record<string, unknown> | null;
};

export type DashboardResponse = {
  messages: DashboardMessage[];
};

export type RateLimitResponse = {
  remaining_in_window: number;
  max_per_hour: number;
  next_allowed_at: string | null;
  paid_user: boolean;
};

export type RangeOption = "THIS_WEEK" | "LAST_WEEK" | "CUSTOM";
