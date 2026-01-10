"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import { formatUsPhoneDigits, normalizeUsPhone } from "@imessage-scheduler/shared";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Textarea } from "@/components/ui/Textarea";

import {
  formatDateKey,
  parseDateKey,
  startOfDay,
} from "@/app/lib/date-utils";
import {
  formatTimeInputValue,
  parseTimeInputValue,
} from "../timeline-helpers";

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
  const [isDateOpen, setIsDateOpen] = useState(false);
  const initializedForId = useRef<string | null>(null);

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
  const minDateValue = startOfDay(new Date());

  useEffect(() => {
    if (!open) {
      initializedForId.current = null;
      return;
    }
    if (mode === "edit" && message) {
      if (initializedForId.current === message.id) {
        return;
      }
      const scheduledAt = new Date(message.scheduled_for_utc);
      setScheduledValue(formatTimeInputValue(scheduledAt));
      setScheduledDateValue(formatDateKey(scheduledAt));
      setToHandle(normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle);
      setBody(message.body ?? "");
      initializedForId.current = message.id;
      return;
    }

    setScheduledValue(baseDate ? formatTimeInputValue(baseDate) : "");
    setScheduledDateValue(baseDate ? formatDateKey(baseDate) : "");
    setToHandle("");
    setBody("");
    initializedForId.current = null;
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
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
              <div className="flex flex-col">
                <Label htmlFor="date-picker" className="text-xs">
                  Date
                </Label>
                {mode === "edit" ? (
                  <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="date-picker"
                        className="w-40 justify-between font-normal"
                      >
                        {scheduledDateValue || "Select date"}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDateKey(scheduledDateValue) ?? undefined}
                        captionLayout="dropdown"
                        disabled={(date) => startOfDay(date) < minDateValue}
                        onSelect={(date) => {
                          if (!date) {
                            return;
                          }
                          setScheduledDateValue(formatDateKey(date));
                          setIsDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button
                    variant="outline"
                    id="date-picker"
                    className="w-46 justify-between font-normal"
                    disabled
                  >
                    {dateLabel}
                  </Button>
                )}
              </div>
              <div className="flex flex-col">
                <Label htmlFor="time-picker" className=" text-xs">
                  Time ({timezone})
                </Label>
                <Input
                  id="time-picker"
                  type="time"
                  value={scheduledValue}
                  onChange={(event) => setScheduledValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    if (!isSubmitting) {
                      void handleSubmit();
                    }
                  }}
                  min={minTime}
                  step={1800}
                  className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
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
          </div>
          <div className="gap-2 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "edit" ? "Save" : "Schedule"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
