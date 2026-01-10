"use client";

import { Input } from "@/components/ui/Input";

type CustomDateRangeFilterProps = {
  customFrom: string;
  onCustomFromChange: (value: string) => void;
  customTo: string;
  onCustomToChange: (value: string) => void;
};

export function CustomDateRangeFilter({
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
}: CustomDateRangeFilterProps) {
  return (
    <div className="flex justify-end gap-1 flex md:flex-row flex-col md:items-end">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">From</span>
        <Input
          type="date"
          value={customFrom}
          onChange={(event) => onCustomFromChange(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">To</span>
        <Input
          type="date"
          value={customTo}
          onChange={(event) => onCustomToChange(event.target.value)}
        />
      </div>
    </div>
  );
}
