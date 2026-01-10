"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { RangeOption, RateLimitResponse } from "../dashboard-types";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "SENDING", label: "Sending" },
  { value: "SENT", label: "Sent" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "RECEIVED", label: "Received" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELED", label: "Canceled" },
];

type DashboardFiltersProps = {
  statusFilter: string;
  onStatusChange: (value: string) => void;
  rangeFilter: RangeOption;
  onRangeChange: (value: RangeOption) => void;
  rateLimitData: RateLimitResponse | undefined;
  onResetRateLimit: () => Promise<void>;
};

export function DashboardFilters({
  statusFilter,
  onStatusChange,
  rangeFilter,
  onRangeChange,
  rateLimitData,
  onResetRateLimit,
}: DashboardFiltersProps) {
  return (
    <div className="flex  items-center gap-2">
      {rateLimitData ? (
        <>
          <Badge variant="outline" className="bg-indigo-700/15">
            Remaining: {rateLimitData.remaining_in_window}/{rateLimitData.max_per_hour}
          </Badge>
          <Button variant="outline" onClick={onResetRateLimit} size="sm" className="ring-0">
            Reset Limit
          </Button>
        </>
      ) : null}

      <select
        className={cn(
          "h-9 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm",
          "shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className={cn(
          "h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm",
          "shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        value={rangeFilter}
        onChange={(event) => onRangeChange(event.target.value as RangeOption)}
      >
        <option value="THIS_WEEK">This week</option>
        <option value="LAST_WEEK">Last week</option>
        <option value="CUSTOM">Custom</option>
      </select>
    </div>
  );
}
