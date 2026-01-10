"use client";

import { normalizeUsPhone } from "@imessage-scheduler/shared";

import { Badge } from "@/components/ui/Badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { formatDateTime, getStatusBadgeClass } from "../dashboard-helpers";
import type { DashboardMessage } from "../dashboard-types";

type DashboardDetailSheetProps = {
  message: DashboardMessage | null;
  onOpenChange: (open: boolean) => void;
};

export function DashboardDetailSheet({ message, onOpenChange }: DashboardDetailSheetProps) {
  return (
    <Sheet
      open={Boolean(message)}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Message details</SheetTitle>
        </SheetHeader>
        {message ? (
          <div className="space-y-4 px-4 pb-6 text-sm">
            <div>
              <p className="text-xs font-medium text-zinc-500">Recipient</p>
              <p className="text-zinc-900">
                {normalizeUsPhone(message.to_handle)?.formatted ?? message.to_handle}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Scheduled</p>
              <p className="text-zinc-900">{formatDateTime(message.scheduled_for_utc)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Status</p>
              <Badge
                variant="secondary"
                className={getStatusBadgeClass(message.status)}
              >
                {message.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Message</p>
              <p className="whitespace-pre-wrap text-zinc-900">
                {message.body || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Last error</p>
              <p className="whitespace-pre-wrap text-zinc-900">
                {message.last_error || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Receipt correlation</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-zinc-950/5 p-3 text-xs text-zinc-700">
                {JSON.stringify(message.receipt_correlation ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
