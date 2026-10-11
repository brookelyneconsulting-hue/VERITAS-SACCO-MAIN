import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function DateRangeFilter({ fromDate, toDate, onFromChange, onToChange, onClear }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => onFromChange(e.target.value)}
        className="w-auto text-sm"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="date"
        value={toDate}
        onChange={(e) => onToChange(e.target.value)}
        className="w-auto text-sm"
      />
      {(fromDate || toDate) && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="w-3.5 h-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}