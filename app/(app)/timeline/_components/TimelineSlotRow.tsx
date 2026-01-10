"use client";

import { GripVertical } from "lucide-react";

import { normalizeUsPhone } from "@imessage-scheduler/shared";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

import type { TimelineMessageItem } from "../timeline-types";

type TimelineSlotRowProps = {
  label: string;
  slotIndex: number;
  messages: TimelineMessageItem[];
  onSelectSlot: (slotIndex: number) => void;
  onEditMessage: (message: TimelineMessageItem) => void;
  onMoveMessage: (messageId: string, slotIndex: number) => void;
  onSlotDragOver: (slotIndex: number, clientY: number) => void;
  onMessageDragStart: (messageId: string, event: React.DragEvent<HTMLSpanElement>) => void;
  onMessageDragEnd: () => void;
  draggingMessageId: string | null;
  dragOverSlotIndex: number | null;
};

export function TimelineSlotRow({
  label,
  slotIndex,
  messages,
  onSelectSlot,
  onEditMessage,
  onMoveMessage,
  onSlotDragOver,
  onMessageDragStart,
  onMessageDragEnd,
  draggingMessageId,
  dragOverSlotIndex,
}: TimelineSlotRowProps) {
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const isDragging = draggingMessageId !== null;
  const isDropTarget = dragOverSlotIndex === slotIndex;

  return (
    <div
      className="grid grid-cols-[90px_minmax(0,1fr)] border-b last:border-b-0"
      data-slot-index={slotIndex}
    >
      <div className="border-r bg-indigo-50 px-3 py-3 text-xs font-semibold text-zinc-600">
        {label}
      </div>
      <div
        className={cn(
          "px-3 py-2 transition-colors",
          isDragging && messages.length === 0 ? "border border-dashed border-indigo-200/70" : "",
          isDropTarget ? "border border-dashed border-indigo-400/70 bg-indigo-50/60" : "",
        )}
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
        onDragOver={(event) => {
          event.preventDefault();
          onSlotDragOver(slotIndex, event.clientY);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const messageId = event.dataTransfer.getData("text/plain");
          if (messageId) {
            onMoveMessage(messageId, slotIndex);
          }
          onMessageDragEnd();
        }}
        data-testid={`slot-${slotIndex}`}
      >
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "group rounded-md bg-indigo-300/15 px-3 py-2 text-xs transition hover:cursor-grab hover:bg-indigo-700/10 hover:ring-1 hover:ring-indigo-700/20 hover:shadow-sm",
                draggingMessageId === message.id ? "opacity-50 scale-[1.02]" : "",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onEditMessage(message);
              }}
              data-testid="timeline-message"
            >
              <div className="flex items-start gap-2"
                draggable
                onDragStart={(event) => onMessageDragStart(message.id, event)}
                onDragEnd={onMessageDragEnd}
              >
                <span
                  className="mt-0.5 text-muted-foreground/70 hover:text-foreground cursor-grab active:cursor-grabbing"
                  aria-label="Drag to reschedule"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
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
              </div>
            </div>
          ))}
          {messages.length === 0 ? (
            <div className="text-[11px] text-zinc-300">
              {isDropTarget ? "Drop to schedule" : "—"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
