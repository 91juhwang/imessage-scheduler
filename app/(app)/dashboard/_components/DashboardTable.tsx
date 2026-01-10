"use client";

import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatDateTime, getStatusBadgeClass, truncate } from "../dashboard-helpers";
import type { DashboardMessage } from "../dashboard-types";

type DashboardTableProps = {
  messages: Array<DashboardMessage & { display_handle: string }>;
  onSelectMessage: (message: DashboardMessage) => void;
};

export function DashboardTable({ messages, onSelectMessage }: DashboardTableProps) {
  return (
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
        {messages.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-sm text-zinc-500">
              No messages found.
            </TableCell>
          </TableRow>
        ) : (
          messages.map((message) => (
            <TableRow
              key={message.id}
              className="cursor-pointer"
              onClick={() => onSelectMessage(message)}
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
                {truncate(message.last_error)}
              </TableCell>
              <TableCell>{formatDateTime(message.delivered_at)}</TableCell>
              <TableCell>{formatDateTime(message.received_at)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
