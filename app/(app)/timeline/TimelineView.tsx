"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

import {
  SLOT_LABELS,
  SLOT_MINUTES,
  formatDateLabel,
  formatIsoWithOffset,
} from "./timeline-helpers";
import { addDays, formatDateKey, startOfDay } from "@/app/lib/date-utils";
import { TimelineMessageDialog } from "./_components/TimelineMessageDialog";
import { TimelineSlotRow } from "./_components/TimelineSlotRow";
import { DatePickerPopover } from "./_components/DatePickerPopover";
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
  const [editingMessage, setEditingMessage] = useState<TimelineMessageItem | null>(null);
  const autoScrollFrame = useRef<number | null>(null);
  const autoScrollY = useRef(0);
  const [draggingMessageId, setDraggingMessageId] = useState<string | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);

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
      if (message.status === "CANCELED") {
        continue;
      }
      const scheduled = new Date(message.scheduled_for_utc);
      const slotIndex =
        scheduled.getHours() * (60 / SLOT_MINUTES) +
        Math.floor(scheduled.getMinutes() / SLOT_MINUTES);
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

    if (scheduled.getTime() <= Date.now() - 30 * 60 * 1000) {
      toast.error("Choose a future time slot.");
      return;
    }

    setDraftTime(scheduled);
    setEditingMessage(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (payload: {
    toHandle: string;
    body: string;
    scheduledAt: Date;
  }) => {
    const scheduledLocal = payload.scheduledAt;
    if (!payload.toHandle.trim() || !payload.body.trim()) {
      toast.error("Phone number and message body are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        editingMessage ? `/api/messages/${editingMessage.id}` : "/api/messages",
        {
          method: editingMessage ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            to_handle: payload.toHandle.trim(),
            body: payload.body.trim(),
            scheduled_for_local: formatIsoWithOffset(scheduledLocal),
            timezone: LOCAL_TIMEZONE,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to schedule message.");
      }

      setIsDialogOpen(false);
      setEditingMessage(null);
      await mutate(messagesKey);
    } catch (err) {
      toast.error(editingMessage ? "Unable to update message." : "Unable to schedule message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMessage = (message: TimelineMessageItem) => {
    if (message.status !== "QUEUED") {
      toast.error("Only queued messages can be edited.");
      return;
    }
    setEditingMessage(message);
    setDraftTime(new Date(message.scheduled_for_utc));
    setIsDialogOpen(true);
  };

  const handleMoveMessage = async (messageId: string, slotIndex: number) => {
    const hours = Math.floor((slotIndex * SLOT_MINUTES) / 60);
    const minutes = (slotIndex * SLOT_MINUTES) % 60;
    const scheduled = new Date(selectedDate);
    scheduled.setHours(hours, minutes, 0, 0);

    if (scheduled.getTime() <= Date.now()) {
      toast.error("Choose a future time slot.");
      return;
    }

    const targetMessage = messageData?.messages.find((message) => message.id === messageId);
    if (targetMessage && targetMessage.status !== "QUEUED") {
      toast.error("Only queued messages can be moved.");
      return;
    }

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduled_for_local: formatIsoWithOffset(scheduled),
          timezone: LOCAL_TIMEZONE,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to move message.");
      }

      await mutate(messagesKey);
    } catch (err) {
      toast.error("Unable to move message.");
    }
  };

  const handleCancelMessage = async () => {
    if (!editingMessage) {
      return;
    }
    if (editingMessage.status !== "QUEUED") {
      toast.error("Only queued messages can be canceled.");
      return;
    }

    try {
      const response = await fetch(`/api/messages/${editingMessage.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to cancel message.");
      }
      setIsDialogOpen(false);
      setEditingMessage(null);
      await mutate(messagesKey);
    } catch (err) {
      toast.error("Unable to cancel message.");
    }
  };

  const handleSlotDragOver = (slotIndex: number, clientY: number) => {
    autoScrollY.current = clientY;
    setDragOverSlotIndex(slotIndex);
    if (autoScrollFrame.current !== null) {
      return;
    }

    autoScrollFrame.current = window.requestAnimationFrame(() => {
      const threshold = 80;
      const speed = 18;
      const y = autoScrollY.current;

      if (y < threshold) {
        window.scrollBy({ top: -speed });
      } else if (y > window.innerHeight - threshold) {
        window.scrollBy({ top: speed });
      }

      autoScrollFrame.current = null;
    });
  };

  const handleMessageDragStart = (
    messageId: string,
    event: React.DragEvent<HTMLSpanElement>,
  ) => {
    event.dataTransfer.setData("text/plain", messageId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingMessageId(messageId);
  };

  const handleMessageDragEnd = () => {
    setDraggingMessageId(null);
    setDragOverSlotIndex(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Timeline</CardTitle>
          <p className="text-sm text-indigo-500">{formatDateLabel(selectedDate)}</p>

        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatePickerPopover
            selectedDate={selectedDate}
            onSelectDate={(nextDate) => {
              setSelectedDate(nextDate);
              router.push(`/timeline?date=${formatDateKey(nextDate)}`);
            }}
          />
          <Button variant="outline" onClick={handlePrevDay}>
            Previous
          </Button>
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
                onEditMessage={handleEditMessage}
                onMoveMessage={handleMoveMessage}
                onSlotDragOver={handleSlotDragOver}
                onMessageDragStart={handleMessageDragStart}
                onMessageDragEnd={handleMessageDragEnd}
                draggingMessageId={draggingMessageId}
                dragOverSlotIndex={dragOverSlotIndex}
              />
            );
          })}
        </div>
      </CardContent>

      <TimelineMessageDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingMessage(null);
          }
        }}
        defaultScheduledAt={draftTime}
        timezone={LOCAL_TIMEZONE}
        isSubmitting={isSubmitting}
        mode={editingMessage ? "edit" : "create"}
        message={editingMessage}
        onCancel={editingMessage ? handleCancelMessage : undefined}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
