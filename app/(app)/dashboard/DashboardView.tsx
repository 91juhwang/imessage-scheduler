"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DashboardMessage, RateLimitResponse } from "./dashboard-types";
import { CustomDateRangeFilter } from "./_components/CustomDateRangeFilter";
import { DashboardDetailSheet } from "./_components/DashboardDetailSheet";
import { DashboardFilters } from "./_components/DashboardFilters";
import { DashboardTable } from "./_components/DashboardTable";
import { useDashboardData } from "./use-dashboard-data";

type DashboardViewProps = {
  initialMessages: DashboardMessage[];
  initialRateLimit: RateLimitResponse | null;
};

export function DashboardView({ initialMessages, initialRateLimit }: DashboardViewProps) {
  const [selectedMessage, setSelectedMessage] = useState<DashboardMessage | null>(
    null,
  );
  const {
    statusFilter,
    setStatusFilter,
    rangeFilter,
    setRangeFilter,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    formattedMessages,
    messagesError,
    messagesLoading,
    rateLimitData,
    resetRateLimit,
  } = useDashboardData({ initialMessages, initialRateLimit });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Dashboard</CardTitle>
          <p className="text-sm text-indigo-500">Queue history and delivery details.</p>
        </div>
        <DashboardFilters
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          rangeFilter={rangeFilter}
          onRangeChange={setRangeFilter}
          rateLimitData={rateLimitData}
          onResetRateLimit={resetRateLimit}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {rangeFilter === "CUSTOM" ? (
          <CustomDateRangeFilter
            customFrom={customFrom}
            onCustomFromChange={setCustomFrom}
            customTo={customTo}
            onCustomToChange={setCustomTo}
          />
        ) : null}
        {messagesError ? (
          <p className="text-sm text-red-600">Unable to load messages.</p>
        ) : null}
        {messagesLoading ? (
          <p className="text-sm text-zinc-500">Loading dashboard…</p>
        ) : null}
        <DashboardTable
          messages={formattedMessages}
          onSelectMessage={setSelectedMessage}
        />
      </CardContent>

      <DashboardDetailSheet
        message={selectedMessage}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMessage(null);
          }
        }}
      />
    </Card>
  );
}
