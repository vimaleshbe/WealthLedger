import { useState } from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { todayISO } from "../lib/utils";
import type { EntryCreate } from "../types";

interface EntryFormProps {
  initial?: Partial<EntryCreate>;
  onSubmit: (data: EntryCreate) => void;
  onCancel: () => void;
}

export default function EntryForm({ initial, onSubmit, onCancel }: EntryFormProps) {
  const today = todayISO();
  const [date, setDate] = useState(initial?.date ?? today);
  const [value, setValue] = useState(initial?.value?.toString() ?? "");
  const [units, setUnits] = useState(initial?.units?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(value);
    const qty = parseFloat(units);
    if (!date) {
      setError("Date is required");
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError("Value must be greater than zero");
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError("Units must be greater than zero");
      return;
    }
    if (date > today) {
      setError("Date cannot be in the future");
      return;
    }
    setError("");
    onSubmit({ date, value: val, units: qty, notes: notes.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="entry_date" className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          Date
        </Label>
        <Input
          id="entry_date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entry_value">Value (INR)</Label>
          <Input
            id="entry_value"
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Total value"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry_units">Units / Quantity</Label>
          <Input
            id="entry_units"
            type="number"
            step="0.001"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="Quantity held"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="entry_notes">Notes</Label>
        <Input
          id="entry_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Entry</Button>
      </div>
    </form>
  );
}
