"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  SLOT_LABELS,
  SLOT_MINUTES,
  addDays,
  formatDateLabel,
  formatDateKey,
  formatIsoWithOffset,
  startOfDay,
} from "./timeline-helpers";
import { TimelineMessageDialog } from "./_components/timeline-message-dialog";
import { TimelineSlotRow } from "./_components/timeline-slot-row";
import type { TimelineMessageItem } from "./timeline-types";

const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type TimelineViewProps = {
  initialDateIso: string;
  initialMessages: TimelineMessageItem[];
};

export function TimelineView({ initialDateIso, initialMessages }: TimelineViewProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const initialDate = useMemo(() => startOfDay(new Date(initialDateIso)), [initialDateIso]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftTime, setDraftTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesKey = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = addDays(start, 1);
    const params = new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    });
    return `/api/messages?${params.toString()}`;
  }, [selectedDate]);

  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to load messages.");
    }
    return (await response.json()) as { messages: TimelineMessageItem[] };
  };

  const {
    data: messageData,
    error,
    isLoading,
  } = useSWR(messagesKey, fetcher, {
    fallbackData: { messages: initialMessages },
  });

  useEffect(() => {
    setSelectedDate(initialDate);
    const start = startOfDay(initialDate);
    const end = addDays(start, 1);
    const params = new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    });
    const key = `/api/messages?${params.toString()}`;
    mutate(key, { messages: initialMessages }, { revalidate: false });
  }, [initialDate, initialMessages, mutate]);

  const slots = useMemo(() => {
    const map = new Map<number, TimelineMessageItem[]>();

    for (const message of messageData?.messages ?? []) {
      const scheduled = new Date(message.scheduled_for_utc);
      const slotIndex = scheduled.getHours() * 2 + Math.floor(scheduled.getMinutes() / 30);
      const list = map.get(slotIndex) ?? [];
      list.push(message);
      map.set(slotIndex, list);
    }

    return map;
  }, [messageData]);

  const handlePrevDay = () => {
    const nextDate = addDays(selectedDate, -1);
    setSelectedDate(nextDate);
    router.push(`/timeline?date=${formatDateKey(nextDate)}`);
  };

  const handleNextDay = () => {
    const nextDate = addDays(selectedDate, 1);
    setSelectedDate(nextDate);
    router.push(`/timeline?date=${formatDateKey(nextDate)}`);
  };

  const handleOpenDraft = (slotIndex: number) => {
    const hours = Math.floor((slotIndex * SLOT_MINUTES) / 60);
    const minutes = (slotIndex * SLOT_MINUTES) % 60;
    const scheduled = new Date(selectedDate);
    scheduled.setHours(hours, minutes, 0, 0);

    if (scheduled.getTime() <= Date.now()) {
      toast.error("Choose a future time slot.");
      return;
    }

    setDraftTime(scheduled);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (payload: {
    toHandle: string;
    body: string;
    scheduledAt: Date;
  }) => {
    const scheduledLocal = payload.scheduledAt;
    if (!payload.toHandle.trim() || !payload.body.trim()) {
      toast.error("Recipient and message body are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to_handle: payload.toHandle.trim(),
          body: payload.body.trim(),
          scheduled_for_local: formatIsoWithOffset(scheduledLocal),
          timezone: LOCAL_TIMEZONE,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule message.");
      }

      setIsDialogOpen(false);
      await mutate(messagesKey);
    } catch (err) {
      toast.error("Unable to schedule message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Timeline</CardTitle>
          <p className="text-sm text-indigo-500">{formatDateLabel(selectedDate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrevDay}>
            Previous
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Date</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) {
                    return;
                  }
                  const nextDate = startOfDay(date);
                  setSelectedDate(nextDate);
                  router.push(`/timeline?date=${formatDateKey(nextDate)}`);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handleNextDay}>
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">Unable to load messages.</p> : null}
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading timeline…</p>
        ) : null}
        <div className="overflow-hidden rounded-md border">
          {SLOT_LABELS.map((label, slotIndex) => {
            const cellMessages = slots.get(slotIndex) ?? [];

            return (
              <TimelineSlotRow
                key={label}
                label={label}
                slotIndex={slotIndex}
                messages={cellMessages}
                onSelectSlot={handleOpenDraft}
              />
            );
          })}
        </div>
      </CardContent>

      <TimelineMessageDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        defaultScheduledAt={draftTime}
        timezone={LOCAL_TIMEZONE}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
