"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatUsPhoneDigits, normalizeUsPhone } from "@imessage-scheduler/shared";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

import { formatDateKey, parseDateKey, startOfDay } from "../timeline-helpers";

type TimelineMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScheduledAt: Date | null;
  timezone: string;
  isSubmitting: boolean;
  mode?: "create" | "edit";
  message?: {
    id: string;
    to_handle: string;
    body?: string | null;
    scheduled_for_utc: string;
  } | null;
  onCancel?: () => Promise<void>;
  onSubmit: (payload: {
    toHandle: string;
    body: string;
    scheduledAt: Date;
  }) => Promise<void>;
};

export function TimelineMessageDialog({
  open,
  onOpenChange,
  defaultScheduledAt,
  timezone,
  isSubmitting,
  mode = "create",
  message,
  onCancel,
  onSubmit,
}: TimelineMessageDialogProps) {
  const [scheduledValue, setScheduledValue] = useState("");
  const [scheduledDateValue, setScheduledDateValue] = useState("");
  const [toHandle, setToHandle] = useState("");
  const [body, setBody] = useState("");

  const baseDate = message ? new Date(message.scheduled_for_utc) : defaultScheduledAt;

  const dateLabel = baseDate
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(baseDate)
    : "Unknown date";

  const activeDate = mode === "edit" ? parseDateKey(scheduledDateValue) : baseDate;
  const minTime = activeDate
    ? startOfDay(activeDate).getTime() === startOfDay(new Date()).getTime()
      ? formatTimeInputValue(new Date())
      : undefined
    : undefined;
  const minDate = formatDateKey(new Date());

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && message) {
      const scheduledAt = new Date(message.scheduled_for_utc);
      setScheduledValue(formatTimeInputValue(scheduledAt));
      setScheduledDateValue(formatDateKey(scheduledAt));
      setToHandle(normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle);
      setBody(message.body ?? "");
    } else {
      setScheduledValue(baseDate ? formatTimeInputValue(baseDate) : "");
      setScheduledDateValue(baseDate ? formatDateKey(baseDate) : "");
      setToHandle("");
      setBody("");
    }
  }, [baseDate, message, mode, open]);

  const handleSubmit = async () => {
    if (!baseDate) {
      toast.error("Choose a valid scheduled time.");
      return;
    }

    const targetDate = mode === "edit" ? parseDateKey(scheduledDateValue) : baseDate;
    if (!targetDate) {
      toast.error("Choose a valid scheduled date.");
      return;
    }

    const scheduledAt = parseTimeInputValue(targetDate, scheduledValue);
    if (!scheduledAt) {
      toast.error("Choose a valid scheduled time.");
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    const normalizedPhone = normalizeUsPhone(toHandle);
    if (!normalizedPhone) {
      toast.error("Enter a valid U.S. phone number.");
      return;
    }

    await onSubmit({
      toHandle: normalizedPhone.e164,
      body,
      scheduledAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit message" : "Schedule message"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the message details and scheduled time."
              : "Create a new iMessage for this timeline slot."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="to-handle">
              Phone number
            </label>
            <Input
              id="to-handle"
              value={toHandle}
              inputMode="numeric"
              maxLength={12}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                setToHandle(formatUsPhoneDigits(digits));
              }}
              onBlur={() => {
                const normalized = normalizeUsPhone(toHandle);
                if (normalized) {
                  setToHandle(normalized.formatted);
                }
              }}
              placeholder="555-123-4567"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="body">
              Message
            </label>
            <Textarea
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Write your message"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="scheduled-time">
              Scheduled time
            </label>
            <Input
              id="scheduled-time"
              type="time"
              value={scheduledValue}
              onChange={(event) => setScheduledValue(event.target.value)}
              min={minTime}
              step={900}
            />
            {mode === "edit" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700" htmlFor="scheduled-date">
                  Scheduled date
                </label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDateValue}
                  onChange={(event) => setScheduledDateValue(event.target.value)}
                  min={minDate}
                />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                Date: <span className="font-medium text-zinc-700">{dateLabel}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Timezone</span>
              <Badge variant="outline" className="text-[10px]">
                {timezone}
              </Badge>
            </div>
          </div>
        </div>
        <DialogFooter>
          <div className="justify-between flex flex-1 items-center">
            {mode === "edit" && onCancel ? (
              <Button
                variant="destructive"
                onClick={async () => {
                  await onCancel();
                }}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            ) : null}
            <div className="gap-2 flex">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : mode === "edit" ? "Save" : "Schedule"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatTimeInputValue(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseTimeInputValue(baseDate: Date, value: string) {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if ([hours, minutes].some((entry) => Number.isNaN(entry))) {
    return null;
  }
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}
