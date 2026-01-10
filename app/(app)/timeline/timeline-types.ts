export type TimelineMessageItem = {
  id: string;
  scheduled_for_utc: string;
  to_handle: string;
  status: string;
  body?: string | null;
  body_preview?: string | null;
};
