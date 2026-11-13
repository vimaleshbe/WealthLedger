import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Gem, IndianRupee } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  asGoldEntryDetails,
  calculateGoldPurchase,
  goldPurityLabel,
  roundMoney,
} from "../lib/gold";
import { formatCurrency, formatNumber, isCashMovementDate, todayISO } from "../lib/utils";
import type {
  AssetType,
  EntryCreate,
  EntryType,
  GoldPurity,
} from "../types";

type EntryFormInitial = Omit<
  Partial<EntryCreate>,
  "cash_value" | "details"
> & {
  cash_value?: number | null;
  details?: Record<string, unknown> | null;
};

interface EntryFormProps {
  initial?: EntryFormInitial;
  kind?: EntryType;
  assetType?: AssetType;
  goldPurity?: GoldPurity;
  goldRatePerGram?: number | null;
  availableUnits?: number;
  availableCash?: number;
  onSubmit: (data: EntryCreate) => void;
  onCancel: () => void;
  isEditing?: boolean;
  isSubmitting?: boolean;
}

export default function EntryForm({
  initial,
  kind,
  assetType,
  goldPurity = "22k",
  goldRatePerGram,
  availableUnits,
  availableCash,
  onSubmit,
  onCancel,
  isEditing = false,
  isSubmitting = false,
}: EntryFormProps) {
  const today = todayISO();
  const entryKind: EntryType = kind ?? initial?.entry_type ?? "buy";
  const isSell = entryKind === "sell";
  const isCash = entryKind === "deposit" || entryKind === "withdrawal";
  const isGold = assetType === "physical_gold";
  const isGoldBuy = isGold && entryKind === "buy";
  const isMutualFund = assetType === "mutual_fund";
  const isMutualFundBuy = isMutualFund && entryKind === "buy";
  const initialGoldDetails = asGoldEntryDetails(initial?.details);

  const initialPrice =
    isSell && initial?.units && initial?.cash_value
      ? (initial.cash_value / initial.units).toString()
      : isMutualFundBuy && initial?.units && initial?.value
        ? Number((initial.value / initial.units).toFixed(6)).toString()
        : "";

  const [date, setDate] = useState(initial?.date ?? today);
  const [value, setValue] = useState(
    isSell ? "" : (initial?.value?.toString() ?? ""),
  );
  const [units, setUnits] = useState(initial?.units?.toString() ?? "");
  const [price, setPrice] = useState(initialPrice);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  const fallbackGoldRate =
    initial?.units && initial?.value
      ? roundMoney(initial.value / initial.units)
      : null;

  const [goldGrams, setGoldGrams] = useState(
    initial?.units?.toString() ?? "",
  );
  const [goldPricePerGram, setGoldPricePerGram] = useState(
    initialGoldDetails.gold_price_per_gram != null
      ? String(initialGoldDetails.gold_price_per_gram)
      : fallbackGoldRate != null
        ? String(fallbackGoldRate)
        : !isEditing && date === today && goldRatePerGram
          ? String(goldRatePerGram)
          : "",
  );
  const [wastagePercent, setWastagePercent] = useState(
    initialGoldDetails.wastage_percent != null
      ? String(initialGoldDetails.wastage_percent)
      : "0",
  );
  const [gstPercent, setGstPercent] = useState(
    initialGoldDetails.gst_percent != null
      ? String(initialGoldDetails.gst_percent)
      : "3",
  );
  const [goldPriceTouched, setGoldPriceTouched] = useState(false);
  const [sellPriceTouched, setSellPriceTouched] = useState(false);
  const purchaseIsToday = date === today;

  /**
   * Cash only moves for live transactions (today/yesterday). Backdated
   * purchases are portfolio history and must not debit the cash balance.
   */
  const entryAffectsCash = isCash || isCashMovementDate(date);

  useEffect(() => {
    if (!isGoldBuy || isEditing || goldPriceTouched) return;
    if (purchaseIsToday && goldRatePerGram && goldRatePerGram > 0) {
      setGoldPricePerGram(String(goldRatePerGram));
    } else if (!purchaseIsToday) {
      // A live rate is only valid for a purchase made today. Historical
      // purchases use the rate printed on the invoice.
      setGoldPricePerGram("");
    }
  }, [
    isGoldBuy,
    isEditing,
    goldPriceTouched,
    goldRatePerGram,
    purchaseIsToday,
  ]);

  useEffect(() => {
    if (!isGold || !isSell || isEditing || sellPriceTouched) return;
    if (purchaseIsToday && goldRatePerGram && goldRatePerGram > 0) {
      setPrice(String(goldRatePerGram));
    } else if (!purchaseIsToday) {
      setPrice("");
    }
  }, [
    isGold,
    isSell,
    isEditing,
    sellPriceTouched,
    goldRatePerGram,
    purchaseIsToday,
  ]);

  const parsedUnits = parseFloat(units);
  const parsedValue = parseFloat(value);
  const parsedPrice = parseFloat(price);
  const computedUnitValue =
    !isNaN(parsedUnits) && !isNaN(parsedPrice) && parsedUnits > 0 && parsedPrice > 0
      ? parsedUnits * parsedPrice
      : 0;

  const parsedGoldGrams = parseFloat(goldGrams);
  const parsedGoldRate = parseFloat(goldPricePerGram);
  const parsedWastage = parseFloat(wastagePercent);
  const parsedGst = parseFloat(gstPercent);
  const goldBreakdown =
    isGoldBuy &&
    !isNaN(parsedGoldGrams) &&
    parsedGoldGrams > 0 &&
    !isNaN(parsedGoldRate) &&
    parsedGoldRate > 0 &&
    !isNaN(parsedWastage) &&
    parsedWastage >= 0 &&
    !isNaN(parsedGst) &&
    parsedGst >= 0
      ? calculateGoldPurchase(
          parsedGoldGrams,
          parsedGoldRate,
          parsedWastage,
          parsedGst,
        )
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!date) {
      setError("Date is required");
      return;
    }
    if (date > today) {
      setError("Date cannot be in the future");
      return;
    }

    if (isGoldBuy) {
      if (isNaN(parsedGoldGrams) || parsedGoldGrams <= 0) {
        setError("Gold weight must be greater than zero");
        return;
      }
      if (isNaN(parsedGoldRate) || parsedGoldRate <= 0) {
        setError("Gold price must be greater than zero");
        return;
      }
      if (isNaN(parsedWastage) || parsedWastage < 0) {
        setError("Wastage cannot be negative");
        return;
      }
      if (isNaN(parsedGst) || parsedGst < 0) {
        setError("GST cannot be negative");
        return;
      }

      const breakdown = calculateGoldPurchase(
        parsedGoldGrams,
        parsedGoldRate,
        parsedWastage,
        parsedGst,
      );
      setError("");
      onSubmit({
        date,
        value: breakdown.goldValue,
        units: parsedGoldGrams,
        cash_value: breakdown.totalPaid,
        entry_type: "buy",
        affects_cash: entryAffectsCash,
        details: {
          gold_price_per_gram: breakdown.pricePerGram,
          gold_value: breakdown.goldValue,
          wastage_percent: breakdown.wastagePercent,
          wastage_amount: breakdown.wastageAmount,
          gst_percent: breakdown.gstPercent,
          gst_amount: breakdown.gstAmount,
          total_paid: breakdown.totalPaid,
          purity: goldPurity,
        },
        notes: notes.trim() || undefined,
      });
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
      const saleValue = parsedUnits * parsedPrice;
      setError("");
      onSubmit({
        date,
        value: saleValue,
        units: parsedUnits,
        cash_value: saleValue,
        entry_type: "sell",
        affects_cash: true,
        details: isGold
          ? {
              gold_price_per_gram: parsedPrice,
              gold_value: saleValue,
              total_paid: saleValue,
              purity: goldPurity,
            }
          : undefined,
        notes: notes.trim() || undefined,
      });
      return;
    }

    if (isMutualFundBuy) {
      if (isNaN(parsedUnits) || parsedUnits <= 0) {
        setError("Quantity must be greater than zero");
        return;
      }
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        setError("Price must be greater than zero");
        return;
      }
      setError("");
      onSubmit({
        date,
        value: parsedUnits * parsedPrice,
        units: parsedUnits,
        entry_type: "buy",
        affects_cash: entryAffectsCash,
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
      affects_cash: entryAffectsCash,
      notes: notes.trim() || undefined,
    });
  };

  const hints: Record<EntryType, string> = {
    buy: !entryAffectsCash
      ? "Backdated purchase. It is added to your portfolio history without changing your cash balance."
      : isGold
        ? "Only the gold value (rate × grams) counts in your portfolio. Wastage and GST are paid from cash."
        : isMutualFund
          ? "Enter units and the price per unit. The purchase amount will be debited from your cash balance."
          : "The purchase amount will be debited from your cash balance.",
    sell: isGold
      ? "The sale proceeds (rate × grams) will be credited to your cash balance."
      : "The sale proceeds will be credited to your cash balance.",
    deposit: "Money will be added to your cash balance.",
    withdrawal: "Money will be removed from your cash balance.",
    interest: "Interest is credited to the asset without increasing invested capital.",
  };

  const submitLabels: Record<EntryType, string> = {
    buy: "Buy",
    sell: "Sell",
    deposit: "Deposit",
    withdrawal: "Withdraw",
    interest: "Add Interest",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        {hints[entryKind]}
      </p>

      {(entryKind === "buy" || entryKind === "withdrawal") &&
        availableCash !== undefined &&
        (entryKind !== "buy" || entryAffectsCash) && (
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

      {isGoldBuy ? (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-muted-foreground">
            <Gem className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {goldPurityLabel(goldPurity)} gold ·{" "}
              {!purchaseIsToday
                ? "enter the rate from this purchase invoice"
                : goldRatePerGram
                  ? `current rate ${formatCurrency(goldRatePerGram)}/g`
                  : "enter the invoice rate"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gold_entry_grams">Weight (grams)</Label>
              <Input
                id="gold_entry_grams"
                type="number"
                step="0.001"
                value={goldGrams}
                onChange={(e) => setGoldGrams(e.target.value)}
                placeholder="e.g. 10"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gold_entry_price">Gold price (₹/gram)</Label>
              <Input
                id="gold_entry_price"
                type="number"
                step="0.01"
                value={goldPricePerGram}
                onChange={(e) => {
                  setGoldPricePerGram(e.target.value);
                  setGoldPriceTouched(true);
                }}
                placeholder="e.g. 12815"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gold_entry_wastage">Wastage (%)</Label>
              <Input
                id="gold_entry_wastage"
                type="number"
                step="0.01"
                value={wastagePercent}
                onChange={(e) => setWastagePercent(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gold_entry_gst">GST (%)</Label>
              <Input
                id="gold_entry_gst"
                type="number"
                step="0.01"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 px-3.5 py-3 text-sm">
            {goldBreakdown ? (
              <dl className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Gold value ({parsedGoldGrams} g ×{" "}
                    {formatCurrency(parsedGoldRate)})
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatCurrency(goldBreakdown.goldValue)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Wastage ({parsedWastage}%)
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(goldBreakdown.wastageAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">GST ({parsedGst}%)</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(goldBreakdown.gstAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                  <dt className="font-medium">Total paid from cash</dt>
                  <dd className="font-semibold tabular-nums text-primary">
                    {formatCurrency(goldBreakdown.totalPaid)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter weight and gold price to see the invoice breakdown.
              </p>
            )}
            {goldBreakdown &&
              availableCash !== undefined &&
              goldBreakdown.totalPaid > availableCash && (
                <p className="mt-2 border-t border-destructive/20 pt-2 text-xs text-destructive">
                  Total paid exceeds available cash by{" "}
                  {formatCurrency(goldBreakdown.totalPaid - availableCash)}.
                </p>
              )}
          </div>
        </>
      ) : isSell ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_units">
                {isGold ? "Weight to sell (grams)" : "Units to sell"}
              </Label>
              <Input
                id="entry_units"
                type="number"
                step="0.001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder={isGold ? "e.g. 5" : "Quantity"}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_price">
                {isGold ? "Sell price (₹/gram)" : "Sell price (per unit)"}
              </Label>
              <Input
                id="entry_price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setSellPriceTouched(true);
                }}
                placeholder={isGold ? "e.g. 13000" : "Price per unit"}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {availableUnits === undefined
                ? "Loading held units…"
                : `Available: ${formatNumber(availableUnits, 3)}${isGold ? " g" : " units"}`}
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
              {formatCurrency(computedUnitValue)}
            </span>
          </div>
        </>
      ) : isMutualFundBuy ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_units">Units / Quantity</Label>
              <Input
                id="entry_units"
                type="number"
                step="0.001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="Quantity purchased"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_price">Price (per unit)</Label>
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
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Purchase value
            </span>
            <span className="font-semibold tabular-nums text-primary">
              {formatCurrency(computedUnitValue)}
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
          disabled={isSubmitting}
          className={isSell ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
        >
          {isSubmitting
            ? "Saving…"
            : isEditing
              ? "Save Changes"
              : submitLabels[entryKind]}
        </Button>
      </div>
    </form>
  );
}
