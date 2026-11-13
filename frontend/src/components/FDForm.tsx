import { useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { addMonthsISO, projectMaturityValue, tenureLabel } from "../lib/fd";
import { formatCurrency, formatDate, todayISO } from "../lib/utils";
import type { Asset, AssetCreate } from "../types";

interface FDFormProps {
  initial?: Asset;
  principal?: number;
  isSubmitting?: boolean;
  onSubmit: (data: AssetCreate) => void;
  onCancel: () => void;
}

export default function FDForm({
  initial,
  principal,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: FDFormProps) {
  const today = todayISO();
  const details = (initial?.details ?? {}) as Record<string, unknown>;
  const initialMonths =
    typeof details.tenure_months === "number"
      ? details.tenure_months
      : Number(details.tenure_months) || null;
  const useYears = initialMonths !== null && initialMonths % 12 === 0;

  const [name, setName] = useState(initial?.name ?? "");
  const [principalValue, setPrincipalValue] = useState(
    initial ? String(principal ?? "") : "",
  );
  const [startDate, setStartDate] = useState(
    typeof details.start_date === "string" ? details.start_date : today,
  );
  const [tenure, setTenure] = useState(
    initialMonths ? String(useYears ? initialMonths / 12 : initialMonths) : "1",
  );
  const [tenureUnit, setTenureUnit] = useState<"years" | "months">(
    useYears ? "years" : "months",
  );
  const [rate, setRate] = useState(
    details.interest_rate != null ? String(details.interest_rate) : "7",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const parsedPrincipal = parseFloat(principalValue) || 0;
  const parsedTenure = parseFloat(tenure) || 0;
  const months = Math.round(
    tenureUnit === "years" ? parsedTenure * 12 : parsedTenure,
  );
  const parsedRate = parseFloat(rate) || 0;
  const maturityDate = addMonthsISO(startDate, months);
  const projected = projectMaturityValue(
    initial ? (principal ?? 0) : parsedPrincipal,
    parsedRate,
    months,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!name.trim()) {
      setError("Enter an FD name.");
      return;
    }
    if (!initial && parsedPrincipal <= 0) {
      setError("Principal must be greater than zero.");
      return;
    }
    if (!startDate) {
      setError("Select a start date.");
      return;
    }
    if (startDate > today) {
      setError("Start date cannot be in the future.");
      return;
    }
    if (months <= 0) {
      setError("Tenure must be greater than zero.");
      return;
    }
    if (parsedRate < 0) {
      setError("Interest rate cannot be negative.");
      return;
    }

    const payload: AssetCreate = {
      name: name.trim(),
      asset_type: "fixed_deposit",
      details: {
        start_date: startDate,
        tenure_months: months,
        interest_rate: parsedRate,
      },
      notes: notes.trim() || undefined,
    };

    if (!initial) {
      payload.initial_date = startDate;
      payload.initial_value = parsedPrincipal;
      payload.initial_units = 1;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Each FD keeps its own principal, tenure and annual interest rate.
          Principal is paid from Cash.
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fd_name">FD name</Label>
        <Input
          id="fd_name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. SBI FD 2026"
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fd_principal">Principal (INR)</Label>
          <Input
            id="fd_principal"
            type="number"
            min="0"
            step="0.01"
            value={principalValue}
            onChange={(event) => setPrincipalValue(event.target.value)}
            placeholder="e.g. 100000"
            readOnly={!!initial}
            className={initial ? "bg-muted/60" : undefined}
          />
          {initial && (
            <p className="text-[11px] text-muted-foreground">
              Principal is fixed. Use Add Interest or Withdraw for changes.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="fd_start">Start date</Label>
          <Input
            id="fd_start"
            type="date"
            value={startDate}
            max={today}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fd_tenure">Tenure</Label>
          <div className="flex gap-2">
            <Input
              id="fd_tenure"
              type="number"
              min="0"
              step="1"
              value={tenure}
              onChange={(event) => setTenure(event.target.value)}
              className="flex-1"
            />
            <Select
              value={tenureUnit}
              onChange={(event) =>
                setTenureUnit(event.target.value as "years" | "months")
              }
              className="w-28"
            >
              <option value="years">Years</option>
              <option value="months">Months</option>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fd_rate">Annual interest rate (%)</Label>
          <Input
            id="fd_rate"
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            placeholder="e.g. 7"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-sm">
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Tenure</dt>
            <dd className="font-medium">{tenureLabel(months)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Maturity date</dt>
            <dd className="font-medium">
              {maturityDate ? formatDate(maturityDate) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">
              Projected value at {parsedRate}% p.a.
            </dt>
            <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {projected !== null ? formatCurrency(projected) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fd_notes">Notes</Label>
        <Input
          id="fd_notes"
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
          {isSubmitting ? "Saving…" : initial ? "Save FD" : "Create FD"}
        </Button>
      </div>
    </form>
  );
}
