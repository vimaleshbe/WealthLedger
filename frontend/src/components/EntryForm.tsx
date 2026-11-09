import { useState } from "react";
import { AlertCircle, CalendarDays, IndianRupee } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency, formatNumber, todayISO } from "../lib/utils";
import type { EntryCreate, EntryType } from "../types";

type EntryFormInitial = Partial<EntryCreate> & { cash_value?: number | null };

interface EntryFormProps {
  initial?: EntryFormInitial;
  kind?: EntryType;
  availableUnits?: number;
  availableCash?: number;
  onSubmit: (data: EntryCreate) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function EntryForm({
  initial,
  kind,
  availableUnits,
  availableCash,
  onSubmit,
  onCancel,
  isEditing = false,
}: EntryFormProps) {
  const today = todayISO();
  const entryKind: EntryType = kind ?? initial?.entry_type ?? "buy";
  const isSell = entryKind === "sell";
  const isCash = entryKind === "deposit" || entryKind === "withdrawal";

  const initialPrice =
    isSell && initial?.units && initial?.cash_value
      ? (initial.cash_value / initial.units).toString()
      : "";

  const [date, setDate] = useState(initial?.date ?? today);
  const [value, setValue] = useState(
    isSell ? "" : (initial?.value?.toString() ?? ""),
  );
  const [units, setUnits] = useState(initial?.units?.toString() ?? "");
  const [price, setPrice] = useState(initialPrice);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const parsedUnits = parseFloat(units);
  const parsedValue = parseFloat(value);
  const parsedPrice = parseFloat(price);
  const computedSaleValue =
    !isNaN(parsedUnits) && !isNaN(parsedPrice) && parsedUnits > 0 && parsedPrice > 0
      ? parsedUnits * parsedPrice
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError("Date is required");
      return;
    }
    if (date > today) {
      setError("Date cannot be in the future");
      return;
    }

    if (isSell) {
      if (isNaN(parsedUnits) || parsedUnits <= 0) {
        setError("Units must be greater than zero");
        return;
      }
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        setError("Sell price must be greater than zero");
        return;
      }
      setError("");
      onSubmit({
        date,
        value: parsedUnits * parsedPrice,
        units: parsedUnits,
        entry_type: "sell",
        affects_cash: true,
        notes: notes.trim() || undefined,
      });
      return;
    }

    if (isNaN(parsedValue) || parsedValue <= 0) {
      setError("Value must be greater than zero");
      return;
    }
    if (!isCash && (isNaN(parsedUnits) || parsedUnits <= 0)) {
      setError("Units must be greater than zero");
      return;
    }

    setError("");
    onSubmit({
      date,
      value: parsedValue,
      units: isCash ? 1 : parsedUnits,
      entry_type: entryKind,
      affects_cash: initial?.affects_cash ?? true,
      notes: notes.trim() || undefined,
    });
  };

  const hints: Record<EntryType, string> = {
    buy: "The purchase amount will be debited from your cash balance.",
    sell: "The sale proceeds will be credited to your cash balance.",
    deposit: "Money will be added to your cash balance.",
    withdrawal: "Money will be removed from your cash balance.",
  };

  const submitLabels: Record<EntryType, string> = {
    buy: "Buy",
    sell: "Sell",
    deposit: "Deposit",
    withdrawal: "Withdraw",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        {hints[entryKind]}
      </p>

      {(entryKind === "buy" || entryKind === "withdrawal") &&
        availableCash !== undefined && (
          <p className="text-xs text-muted-foreground">
            Available cash:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(availableCash)}
            </span>
          </p>
        )}

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

      {isSell ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_units">Units to sell</Label>
              <Input
                id="entry_units"
                type="number"
                step="0.001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="Quantity"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_price">Sell price (per unit)</Label>
              <Input
                id="entry_price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price per unit"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {availableUnits === undefined
                ? "Loading held units…"
                : `Available: ${formatNumber(availableUnits, 3)} units`}
            </span>
            {!isEditing && (availableUnits ?? 0) > 0 && (
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setUnits(String(availableUnits))}
              >
                Sell all
              </button>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Sale value
            </span>
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(computedSaleValue)}
            </span>
          </div>
        </>
      ) : (
        <div className={isCash ? "space-y-2" : "grid gap-4 sm:grid-cols-2"}>
          <div className="space-y-2">
            <Label htmlFor="entry_value">
              {isCash ? "Amount (INR)" : "Value (INR)"}
            </Label>
            <Input
              id="entry_value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isCash ? "Amount" : "Total value"}
              autoFocus
            />
          </div>
          {!isCash && (
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
          )}
        </div>
      )}

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
        <Button
          type="submit"
          className={isSell ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
        >
          {isEditing ? "Save Changes" : submitLabels[entryKind]}
        </Button>
      </div>
    </form>
  );
}
