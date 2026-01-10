"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

import { startOfDay } from "@/app/lib/date-utils";

type DatePickerPopoverProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function DatePickerPopover({
  selectedDate,
  onSelectDate,
}: DatePickerPopoverProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
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
            onSelectDate(startOfDay(date));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
