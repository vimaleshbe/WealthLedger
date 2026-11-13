import { useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  asPFComponents,
  latestInterestDate,
  pfComponentsTotal,
} from "../lib/retirement";
import { cn, formatCurrency, formatNumber, todayISO } from "../lib/utils";
import type { AssetEntry, AssetType, EntryCreate } from "../types";

export type RetirementEntryKind = "contribution" | "interest" | "withdrawal";

interface RetirementFormProps {
  assetType: AssetType;
  initial?: AssetEntry;
  defaultKind?: RetirementEntryKind;
  availableBalance?: number;
  availableCash?: number;
  availableUnits?: number;
  isSubmitting?: boolean;
  onSubmit: (data: EntryCreate) => void;
  onCancel: () => void;
}

function kindFromEntry(
  entry: AssetEntry | undefined,
  fallback: RetirementEntryKind,
): RetirementEntryKind {
  if (entry?.entry_type === "interest") return "interest";
  if (entry?.entry_type === "sell") return "withdrawal";
  if (entry?.entry_type === "buy") return "contribution";
  return fallback;
}

export default function RetirementForm({
  assetType,
  initial,
  defaultKind = "contribution",
  availableBalance,
  availableCash,
  availableUnits,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: RetirementFormProps) {
  const today = todayISO();
  const isPF = assetType === "pf";
  const isPPF = assetType === "ppf";
  const isNPS = assetType === "nps";
  const components = asPFComponents(initial?.details);
  const initialDetails = initial?.details ?? {};
  const initialNav = Number(initialDetails.nav ?? initialDetails.nps_nav);
  // The action is chosen by the button that opened this dialog and cannot be
  // changed here.
  const kind = kindFromEntry(initial, defaultKind);
  const [date, setDate] = useState(
    initial?.date ??
      (isPPF && defaultKind === "interest" ? latestInterestDate(today) : today),
  );
  const [employee, setEmployee] = useState(
    initial?.entry_type === "buy" && components.employee_share
      ? String(components.employee_share)
      : "",
  );
  const [employer, setEmployer] = useState(
    initial?.entry_type === "buy" && components.employer_share
      ? String(components.employer_share)
      : "",
  );
  const [pension, setPension] = useState(
    initial?.entry_type === "buy" && components.pension_share
      ? String(components.pension_share)
      : "",
  );
  const [amount, setAmount] = useState(
    initial && (initial.entry_type !== "buy" || !isPF)
      ? String(initial.value)
      : "",
  );
  const [npsUnits, setNpsUnits] = useState(
    initial ? String(initial.units) : "",
  );
  const [npsNav, setNpsNav] = useState(
    Number.isFinite(initialNav) && initialNav > 0 ? String(initialNav) : "",
  );
  const [affectsCash, setAffectsCash] = useState(
    initial ? initial.affects_cash : false,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const employeeValue = parseFloat(employee) || 0;
  const employerValue = parseFloat(employer) || 0;
  const pensionValue = parseFloat(pension) || 0;
  const contributionTotal = pfComponentsTotal({
    employee_share: employeeValue,
    employer_share: employerValue,
    pension_share: pensionValue,
  });
  const singleAmount = parseFloat(amount) || 0;
  const npsUnitsValue = parseFloat(npsUnits) || 0;
  const npsNavValue = parseFloat(npsNav) || 0;
  const npsAmount = Math.round(npsUnitsValue * npsNavValue * 100) / 100;

  const submitLabel = initial
    ? "Save entry"
    : isNPS
      ? kind === "contribution"
        ? "Invest"
        : "Redeem"
      : isPPF
        ? kind === "contribution"
          ? "Add money"
          : kind === "interest"
            ? "Add interest"
            : "Withdraw"
        : "Add entry";

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

    if (isNPS) {
      if (kind === "interest") {
        setError("NPS is market-linked. Enter units and NAV instead.");
        return;
      }
      if (npsUnitsValue <= 0) {
        setError("Units must be greater than zero.");
        return;
      }
      if (npsNavValue <= 0) {
        setError("NAV per unit must be greater than zero.");
        return;
      }
      if (
        kind === "withdrawal" &&
        availableUnits !== undefined &&
        npsUnitsValue > availableUnits + 1e-6
      ) {
        setError(
          `Cannot redeem more than ${formatNumber(availableUnits, 4)} units.`,
        );
        return;
      }
      onSubmit({
        date,
        value: npsAmount,
        units: npsUnitsValue,
        entry_type: kind === "withdrawal" ? "sell" : "buy",
        affects_cash: affectsCash,
        details: {
          kind: kind === "withdrawal" ? "nps_redeem" : "nps_invest",
          nav: npsNavValue,
        },
        notes: notes.trim() || undefined,
      });
      return;
    }

    if (kind === "contribution") {
      if (isPF) {
        if (employeeValue < 0 || employerValue < 0 || pensionValue < 0) {
          setError("PF amounts cannot be negative.");
          return;
        }
        if (contributionTotal <= 0) {
          setError("Enter at least one of employee, employer or pension amount.");
          return;
        }
        onSubmit({
          date,
          value: contributionTotal,
          units: 1,
          entry_type: "buy",
          affects_cash: false,
          details: {
            employee_share: employeeValue,
            employer_share: employerValue,
            pension_share: pensionValue,
          },
          notes: notes.trim() || undefined,
        });
        return;
      }

      if (singleAmount <= 0) {
        setError("Contribution amount must be greater than zero.");
        return;
      }
      if (
        isPPF &&
        availableCash !== undefined &&
        singleAmount > availableCash + 0.005
      ) {
        setError(
          `Cash balance is ${formatCurrency(availableCash)}. Add money to Cash before funding this PPF contribution.`,
        );
        return;
      }
      onSubmit({
        date,
        value: singleAmount,
        units: 1,
        entry_type: "buy",
        affects_cash: isPPF ? true : affectsCash,
        details: { kind: "contribution" },
        notes: notes.trim() || undefined,
      });
      return;
    }

    if (singleAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (
      kind === "withdrawal" &&
      availableBalance !== undefined &&
      singleAmount > availableBalance + 0.005
    ) {
      setError(
        `Withdrawal cannot exceed the account balance of ${formatCurrency(availableBalance)}.`,
      );
      return;
    }

    onSubmit({
      date,
      value: singleAmount,
      units: 1,
      entry_type: kind === "interest" ? "interest" : "sell",
      affects_cash:
        kind === "withdrawal" ? (isPPF ? true : affectsCash) : false,
      details:
        kind === "interest"
          ? { kind: "interest" }
          : { kind: "retirement_withdrawal", retirement_withdrawal: true },
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {isPF
            ? kind === "contribution"
              ? "PF contributions keep the employee, employer and pension amounts from your passbook."
              : kind === "interest"
                ? "PF interest is added to the account balance without touching Cash."
                : "PF withdrawals reduce the account balance and do not touch Cash."
            : isPPF
              ? "PPF is a 15-year account. Money added is paid from Cash, withdrawals are credited to Cash, and interest is updated on 31 March each year."
              : isNPS
                ? "NPS is market-linked like a mutual fund. Enter units and NAV; current value = units × latest NAV."
                : `${assetType.toUpperCase()} uses a single contribution amount. Add interest or withdraw when needed.`}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="retirement_date">Date</Label>
        <Input
          id="retirement_date"
          type="date"
          value={date}
          max={today}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      {isPPF && kind === "interest" && (
        <p className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
          Interest is credited on 31 March. The date is pre-filled with the
          latest 31 March; choose the correct year if you are backfilling.
        </p>
      )}

      {kind === "contribution" && isPF ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pf_employee">Employee share</Label>
              <Input
                id="pf_employee"
                type="number"
                min="0"
                step="0.01"
                value={employee}
                onChange={(event) => setEmployee(event.target.value)}
                placeholder="e.g. 14922"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf_employer">Employer share</Label>
              <Input
                id="pf_employer"
                type="number"
                min="0"
                step="0.01"
                value={employer}
                onChange={(event) => setEmployer(event.target.value)}
                placeholder="e.g. 13672"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf_pension">Pension share</Label>
              <Input
                id="pf_pension"
                type="number"
                min="0"
                step="0.01"
                value={pension}
                onChange={(event) => setPension(event.target.value)}
                placeholder="e.g. 1250"
              />
            </div>
          </div>
          <p className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-sm">
            Total contribution:{" "}
            <span className="font-semibold text-primary">
              {formatCurrency(contributionTotal)}
            </span>
          </p>
        </>
      ) : isNPS ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nps_units">
                {kind === "withdrawal" ? "Units to redeem" : "Units purchased"}
              </Label>
              <Input
                id="nps_units"
                type="number"
                min="0"
                step="0.0001"
                value={npsUnits}
                onChange={(event) => setNpsUnits(event.target.value)}
                placeholder="e.g. 100"
                autoFocus
              />
              {kind === "withdrawal" && availableUnits !== undefined && (
                <p className="text-[11px] text-muted-foreground">
                  Available units: {formatNumber(availableUnits, 4)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nps_nav">NAV per unit</Label>
              <Input
                id="nps_nav"
                type="number"
                min="0"
                step="0.0001"
                value={npsNav}
                onChange={(event) => setNpsNav(event.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm">
            <span className="font-medium text-muted-foreground">
              {kind === "withdrawal" ? "Redemption value" : "Investment amount"}
            </span>
            <span className="font-semibold tabular-nums text-primary">
              {formatCurrency(npsAmount)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="retirement_amount">
            {kind === "contribution"
              ? isPPF
                ? "Amount to add"
                : "Contribution amount"
              : kind === "interest"
                ? isPPF
                  ? "Interest credited"
                  : "Interest / growth amount"
                : isPPF
                  ? "Amount to withdraw"
                  : "Withdrawal amount"}
          </Label>
          <Input
            id="retirement_amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={
              kind === "withdrawal" ? "e.g. 50000" : "e.g. 150000"
            }
          />
          {kind === "withdrawal" && availableBalance !== undefined && (
            <p className="text-[11px] text-muted-foreground">
              Available balance: {formatCurrency(availableBalance)}
            </p>
          )}
        </div>
      )}

      {isPPF && kind !== "interest" && (
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-sm">
          <p className="font-medium">
            {kind === "contribution" ? "Paid from Cash" : "Credited to Cash"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kind === "contribution"
              ? "This amount is debited from your tracked Cash balance"
              : "This amount is added back to your tracked Cash balance"}
            {availableCash !== undefined
              ? ` (current balance: ${formatCurrency(availableCash)}).`
              : "."}
          </p>
          {kind === "contribution" &&
            availableCash !== undefined &&
            singleAmount > availableCash + 0.005 && (
              <p className="mt-1.5 text-xs text-destructive">
                This is more than the available Cash balance by{" "}
                {formatCurrency(singleAmount - availableCash)}.
              </p>
            )}
        </div>
      )}

      {!isPF && !isPPF && kind !== "interest" && (
        <label className="flex items-start gap-2.5 rounded-lg border border-border/70 px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={affectsCash}
            onChange={(event) => setAffectsCash(event.target.checked)}
            className={cn(
              "mt-0.5 h-4 w-4 rounded border-border text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          <span>
            <span className="font-medium">
              {kind === "contribution" ? "Paid from cash" : "Credit to cash"}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {kind === "contribution"
                ? "Debit the tracked Cash balance for this contribution."
                : "Add the withdrawal to the tracked Cash balance."}
            </span>
          </span>
        </label>
      )}

      <div className="space-y-2">
        <Label htmlFor="retirement_notes">Notes</Label>
        <Input
          id="retirement_notes"
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
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
