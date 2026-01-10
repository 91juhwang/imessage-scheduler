// makes it readonly
export const IMMUTABLE_STATUSES = [
  "SENT",
  "DELIVERED",
  "RECEIVED",
  "FAILED",
  "CANCELED",
] as const;

// converts to union type of the array elements
export type ImmutableStatus = (typeof IMMUTABLE_STATUSES)[number];

export function isImmutableStatus(
  status: string,
): status is ImmutableStatus {
  // TypeScript complains about .includes() with literal unions
  return (IMMUTABLE_STATUSES as readonly string[]).includes(status);
}
