"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { normalizeUsPhone } from "@imessage-scheduler/shared";

import {
  addDays,
  endOfDay,
  formatDateKey,
  parseDateKey,
  startOfDay,
  startOfWeek,
} from "@/app/lib/date-utils";
import type {
  DashboardMessage,
  DashboardResponse,
  RangeOption,
  RateLimitResponse,
} from "./dashboard-types";

type UseDashboardDataOptions = {
  initialMessages: DashboardMessage[];
  initialRateLimit: RateLimitResponse | null;
};

type DashboardMessageWithDisplay = DashboardMessage & { display_handle: string };

export function useDashboardData({
  initialMessages,
  initialRateLimit,
}: UseDashboardDataOptions) {
  const { mutate } = useSWRConfig();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rangeFilter, setRangeFilter] = useState<RangeOption>("THIS_WEEK");
  const [customFrom, setCustomFrom] = useState(() => formatDateKey(new Date()));
  const [customTo, setCustomTo] = useState(() => formatDateKey(new Date()));

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

  const { data, error, isLoading } = useSWR<DashboardResponse>(messagesKey, fetcher, {
    fallbackData: { messages: initialMessages },
  });
  const { data: rateLimitData } = useSWR<RateLimitResponse>(
    "/api/rate-limit",
    fetcher,
    {
      fallbackData: initialRateLimit ?? undefined,
    },
  );

  const formattedMessages = useMemo<DashboardMessageWithDisplay[]>(
    () =>
      (data?.messages ?? [])
        .map((message) => ({
          ...message,
          display_handle:
            normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle,
        }))
        .sort(
          (a, b) =>
            new Date(b.scheduled_for_utc).getTime() -
            new Date(a.scheduled_for_utc).getTime(),
        ),
    [data],
  );

  const resetRateLimit = async () => {
    await fetch("/api/rate-limit", { method: "POST" });
    await mutate("/api/rate-limit");
  };

  const showLoading = isLoading && formattedMessages.length === 0;

  return {
    statusFilter,
    setStatusFilter,
    rangeFilter,
    setRangeFilter,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    formattedMessages,
    messagesError: error,
    messagesLoading: showLoading,
    rateLimitData,
    resetRateLimit,
  };
}
