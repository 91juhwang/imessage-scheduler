"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { normalizeUsPhone } from "@imessage-scheduler/shared";

import { addDays, endOfDay, formatDateKey, parseDateKey, startOfDay, startOfWeek } from "@/app/lib/date-utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

type DashboardMessage = {
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

type DashboardResponse = {
  messages: DashboardMessage[];
};

type RateLimitResponse = {
  remaining_in_window: number;
  max_per_hour: number;
  next_allowed_at: string | null;
  paid_user: boolean;
};

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

type RangeOption = "THIS_WEEK" | "LAST_WEEK" | "CUSTOM";

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return "";
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function truncate(value: string | null, length = 40) {
  if (!value) {
    return "—";
  }
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…`;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "QUEUED":
      return "bg-yellow-100 text-zinc-900";
    case "SENT":
      return "bg-green-200/70 text-black";
    case "DELIVERED":
      return "bg-blue-300/50 text-black";
    case "CANCELED":
      return "bg-red-300/50 text-black";
    default:
      return "bg-zinc-100 text-zinc-900";
  }
}

export function DashboardView() {
  const { mutate } = useSWRConfig();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rangeFilter, setRangeFilter] = useState<RangeOption>("THIS_WEEK");
  const [customFrom, setCustomFrom] = useState(() => formatDateKey(new Date()));
  const [customTo, setCustomTo] = useState(() => formatDateKey(new Date()));
  const [selectedMessage, setSelectedMessage] = useState<DashboardMessage | null>(
    null,
  );

  const range = useMemo(() => {
    const today = new Date();
    if (rangeFilter === "THIS_WEEK") {
      const start = startOfWeek(today);
      return { from: start, to: endOfDay(addDays(start, 6)) };
    }
    if (rangeFilter === "LAST_WEEK") {
      const start = startOfWeek(addDays(today, -7));
      return { from: start, to: endOfDay(addDays(start, 6)) };
    }
    const fromDate = parseDateKey(customFrom);
    const toDate = parseDateKey(customTo);
    return {
      from: fromDate ? startOfDay(fromDate) : null,
      to: toDate ? endOfDay(toDate) : null,
    };
  }, [customFrom, customTo, rangeFilter]);

  const messagesKey = useMemo(() => {
    const params = new URLSearchParams();
    if (range.from) {
      params.set("from", range.from.toISOString());
    }
    if (range.to) {
      params.set("to", range.to.toISOString());
    }
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }
    const query = params.toString();
    return `/api/messages${query ? `?${query}` : ""}`;
  }, [range, statusFilter]);

  const fetcher = async <T,>(url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to load messages.");
    }
    return (await response.json()) as T;
  };

  const { data, error, isLoading } = useSWR<DashboardResponse>(messagesKey, fetcher);
  const { data: rateLimitData } = useSWR<RateLimitResponse>(
    "/api/rate-limit",
    fetcher,
  );

  const formattedMessages = useMemo(
    () =>
      (data?.messages ?? [])
        .map((message) => ({
          ...message,
          display_handle: normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle,
        }))
        .sort(
          (a, b) =>
            new Date(b.scheduled_for_utc).getTime() -
            new Date(a.scheduled_for_utc).getTime(),
        ),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Dashboard</CardTitle>
          <p className="text-sm text-indigo-500">Queue history and delivery details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rateLimitData ? (
            <>
              <Badge variant="outline" className="bg-indigo-700/15">
                Remaining: {rateLimitData.remaining_in_window}/{rateLimitData.max_per_hour}
              </Badge>
              <Button
                variant="outline"
                onClick={async () => {
                  await fetch("/api/rate-limit", { method: "POST" });
                  await mutate("/api/rate-limit");
                }}
              >
                Reset Rate Limit
              </Button>
            </>
          ) : null}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rangeFilter} onValueChange={(value) => setRangeFilter(value as RangeOption)}>
            <SelectTrigger className="min-w-[140px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="THIS_WEEK">This week</SelectItem>
              <SelectItem value="LAST_WEEK">Last week</SelectItem>
              <SelectItem value="CUSTOM">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rangeFilter === "CUSTOM" ? (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">From</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">To</span>
              <Input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">Unable to load messages.</p> : null}
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading dashboard…</p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheduled</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formattedMessages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-zinc-500">
                  No messages found.
                </TableCell>
              </TableRow>
            ) : (
              formattedMessages.map((message) => (
                <TableRow
                  key={message.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedMessage(message)}
                >
                  <TableCell>{formatDateTime(message.scheduled_for_utc)}</TableCell>
                  <TableCell>{message.display_handle}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusBadgeClass(message.status)}>
                      {message.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{message.attempt_count}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {message.last_error}
                  </TableCell>
                  <TableCell>{formatDateTime(message.delivered_at)}</TableCell>
                  <TableCell>{formatDateTime(message.received_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Sheet
        open={Boolean(selectedMessage)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMessage(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Message details</SheetTitle>
          </SheetHeader>
          {selectedMessage ? (
            <div className="space-y-4 px-4 pb-6 text-sm">
              <div>
                <p className="text-xs font-medium text-zinc-500">Recipient</p>
                <p className="text-zinc-900">
                  {normalizeUsPhone(selectedMessage.to_handle)?.formatted ??
                    selectedMessage.to_handle}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Scheduled</p>
                <p className="text-zinc-900">
                  {formatDateTime(selectedMessage.scheduled_for_utc)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Status</p>
                <Badge
                  variant="secondary"
                  className={getStatusBadgeClass(selectedMessage.status)}
                >
                  {selectedMessage.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Message</p>
                <p className="whitespace-pre-wrap text-zinc-900">
                  {selectedMessage.body || ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Last error</p>
                <p className="whitespace-pre-wrap text-zinc-900">
                  {selectedMessage.last_error || ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Receipt correlation</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-zinc-950/5 p-3 text-xs text-zinc-700">
                  {JSON.stringify(selectedMessage.receipt_correlation ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
