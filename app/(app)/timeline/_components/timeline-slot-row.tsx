"use client";

import { normalizeUsPhone } from "@imessage-scheduler/shared";
import { Badge } from "@/components/ui/badge";

import type { TimelineMessageItem } from "../timeline-types";

type TimelineSlotRowProps = {
  label: string;
  slotIndex: number;
  messages: TimelineMessageItem[];
  onSelectSlot: (slotIndex: number) => void;
};

export function TimelineSlotRow({
  label,
  slotIndex,
  messages,
  onSelectSlot,
}: TimelineSlotRowProps) {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] border-b last:border-b-0">
      <div className="border-r bg-indigo-50 px-3 py-3 text-xs font-semibold text-zinc-600">
        {label}
      </div>
      <div
        className="px-3 py-2"
        role="button"
        tabIndex={0}
        aria-label={`Schedule message at ${label}`}
        onClick={() => onSelectSlot(slotIndex)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectSlot(slotIndex);
          }
        }}
      >
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className="rounded-md bg-indigo-300/15 px-3 py-2 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-800">
                  {normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle}
                </span>
                <Badge variant="secondary" className="text-[9px] bg-yellow-100">
                  {message.status}
                </Badge>
              </div>
              <div className="mt-1 text-[10px] text-zinc-700">
                {timeFormatter.format(new Date(message.scheduled_for_utc))}
              </div>
            </div>
          ))}
          {messages.length === 0 ? (
            <div className="text-[11px] text-zinc-300">—</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
