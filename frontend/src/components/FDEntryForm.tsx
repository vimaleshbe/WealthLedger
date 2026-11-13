import { useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency, todayISO } from "../lib/utils";
import type { AssetEntry, EntryCreate } from "../types";

export type FDEntryKind = "interest" | "withdrawal";

interface FDEntryFormProps {
  kind: FDEntryKind;
  initial?: AssetEntry;
  availableBalance?: number;
  isSubmitting?: boolean;
  onSubmit: (data: EntryCreate) => void;
  onCancel: () => void;
}

export default function FDEntryForm({
  kind,
  initial,
  availableBalance,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: FDEntryFormProps) {
  const today = todayISO();
  const [date, setDate] = useState(initial?.date ?? today);
  const [amount, setAmount] = useState(initial ? String(initial.value) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const isWithdrawal = kind === "withdrawal";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!date) {
      setError("Select a date.");
      return;
    }
    if (date > today) {
      setError("The date cannot be in the future.");
      return;
    }
    if (parsedAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (
      isWithdrawal &&
      availableBalance !== undefined &&
      parsedAmount > availableBalance + 0.005
    ) {
      setError(
        `Withdrawal cannot exceed the FD balance of ${formatCurrency(
          availableBalance,
        )}.`,
      );
      return;
    }

    onSubmit({
      date,
      value: parsedAmount,
      units: 1,
      entry_type: isWithdrawal ? "sell" : "interest",
      affects_cash: isWithdrawal,
      details: { kind: isWithdrawal ? "fd_withdrawal" : "fd_interest" },
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {isWithdrawal
            ? "The withdrawal is credited back to Cash and reduces the FD balance."
            : "Interest is added to the FD balance without touching Cash."}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fd_entry_date">Date</Label>
        <Input
          id="fd_entry_date"
          type="date"
          value={date}
          max={today}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fd_entry_amount">
          {isWithdrawal ? "Amount to withdraw" : "Interest credited"}
        </Label>
        <Input
          id="fd_entry_amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="e.g. 5000"
          autoFocus
        />
        {isWithdrawal && availableBalance !== undefined && (
          <p className="text-[11px] text-muted-foreground">
            Available FD balance: {formatCurrency(availableBalance)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fd_entry_notes">Notes</Label>
        <Input
          id="fd_entry_notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : initial
              ? "Save entry"
              : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
