import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Gem,
  IndianRupee,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import AssetTypeSelect from "./AssetTypeSelect";
import { useGoldRates } from "../api/gold";
import { useSymbolSearch } from "../api/search";
import {
  GOLD_PURITIES,
  calculateGoldPurchase,
  goldPurityLabel,
  normalizeGoldPurity,
} from "../lib/gold";
import { formatCurrency, formatRelativeTime, todayISO } from "../lib/utils";
import type { AssetCreate, AssetType, GoldPurity } from "../types";

interface AssetFormProps {
  initial?: Partial<AssetCreate> & { gold_purity?: GoldPurity | null };
  onSubmit: (data: AssetCreate) => void;
  onCancel: () => void;
}

const SEARCHABLE_TYPES: AssetType[] = [
  "stock",
  "mutual_fund",
  "liquid_fund",
  "arbitrage_fund",
];
const REAL_ESTATE_TYPE: AssetType = "real_estate";
const GOLD_TYPE: AssetType = "physical_gold";

interface InitialEntry {
  date: string;
  value: number;
  units: number;
  cash_value?: number;
  details?: Record<string, unknown>;
}

export default function AssetForm({ initial, onSubmit, onCancel }: AssetFormProps) {
  const isEditing = !!initial?.name;
  const today = todayISO();

  const [name, setName] = useState(initial?.name ?? "");
  const [assetType, setAssetType] = useState<AssetType>(initial?.asset_type ?? "stock");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [initialDate, setInitialDate] = useState(initial?.initial_date ?? today);
  const [initialValue, setInitialValue] = useState(initial?.initial_value?.toString() ?? "");
  const [initialUnits, setInitialUnits] = useState(initial?.initial_units?.toString() ?? "");
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Real estate specific fields
  const initialDetails = (initial?.details ?? {}) as Record<string, unknown>;
  const [price, setPrice] = useState((initialDetails.price as string) ?? "");
  const [documentation, setDocumentation] = useState(
    (initialDetails.documentation as string) ?? "",
  );
  const [broker, setBroker] = useState((initialDetails.broker as string) ?? "");

  // Physical gold specific fields
  const [purity, setPurity] = useState<GoldPurity>(
    normalizeGoldPurity(initial?.gold_purity ?? initialDetails.purity),
  );
  const [goldPricePerGram, setGoldPricePerGram] = useState("");
  const [wastagePercent, setWastagePercent] = useState("0");
  const [gstPercent, setGstPercent] = useState("3");
  const [goldPriceTouched, setGoldPriceTouched] = useState(false);

  const isGold = assetType === GOLD_TYPE;
  const purchaseIsToday = initialDate === today;
  const goldRates = useGoldRates(isGold && !isEditing);
  const currentGoldRate = goldRates.data?.rates[purity];

  useEffect(() => {
    if (!isGold || isEditing || goldPriceTouched) return;
    if (purchaseIsToday && currentGoldRate?.price_per_gram) {
      setGoldPricePerGram(String(currentGoldRate.price_per_gram));
    } else if (!purchaseIsToday) {
      // Live rates are only meaningful for a purchase made today. Past
      // purchases must use the rate printed on the invoice.
      setGoldPricePerGram("");
    }
  }, [
    isGold,
    isEditing,
    goldPriceTouched,
    currentGoldRate,
    purchaseIsToday,
  ]);

  const searchType =
    assetType === "stock"
      ? "stock"
      : SEARCHABLE_TYPES.includes(assetType)
        ? "mutual_fund"
        : undefined;
  const { data: searchData, isLoading: searchLoading } = useSymbolSearch(
    symbol,
    searchType,
  );

  const suggestions = searchData?.results ?? [];

  useEffect(() => {
    if (assetType === REAL_ESTATE_TYPE) {
      const p = parseFloat(price) || 0;
      const d = parseFloat(documentation) || 0;
      const b = parseFloat(broker) || 0;
      const total = p + d + b;
      if (total > 0) {
        setInitialValue(total.toString());
      }
      if (!initialUnits) {
        setInitialUnits("1");
      }
    }
  }, [price, documentation, broker, assetType, initialUnits]);

  const goldGrams = parseFloat(initialUnits);
  const goldRate = parseFloat(goldPricePerGram);
  const parsedWastage = parseFloat(wastagePercent);
  const parsedGst = parseFloat(gstPercent);
  const goldBreakdown =
    !isNaN(goldGrams) &&
    goldGrams > 0 &&
    !isNaN(goldRate) &&
    goldRate > 0 &&
    !isNaN(parsedWastage) &&
    parsedWastage >= 0 &&
    !isNaN(parsedGst) &&
    parsedGst >= 0
      ? calculateGoldPurchase(goldGrams, goldRate, parsedWastage, parsedGst)
      : null;

  const handleAssetTypeChange = (type: AssetType) => {
    const wasGold = assetType === GOLD_TYPE;
    setAssetType(type);
    setSymbol("");
    setShowSuggestions(false);
    if (type !== REAL_ESTATE_TYPE) {
      setPrice("");
      setDocumentation("");
      setBroker("");
    }
    if (type !== GOLD_TYPE) {
      setPurity("22k");
      setGoldPricePerGram("");
      setWastagePercent("0");
      setGstPercent("3");
      setGoldPriceTouched(false);
    }
    if (type === GOLD_TYPE || wasGold) {
      setInitialValue("");
      setInitialUnits("");
    }
  };

  const handlePurityChange = (value: GoldPurity) => {
    setPurity(value);
    setGoldPriceTouched(false);
    const rate = goldRates.data?.rates[value];
    setGoldPricePerGram(
      purchaseIsToday && rate ? String(rate.price_per_gram) : "",
    );
  };

  const handleSymbolChange = (value: string) => {
    setSymbol(value);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (selectedSymbol: string, selectedName: string) => {
    setSymbol(selectedSymbol);
    if (!name.trim()) {
      setName(selectedName);
    }
    setShowSuggestions(false);
  };

  const wantsInitialEntry = () => {
    if (isGold) {
      // The live rate is prefilled, so only the weight means that the user
      // intended to record an opening purchase.
      return initialUnits.trim() !== "";
    }
    return (
      initialValue.trim() !== "" ||
      (assetType !== REAL_ESTATE_TYPE && initialUnits.trim() !== "")
    );
  };

  const validateInitialEntry = (): InitialEntry | null => {
    if (isEditing) return null;

    if (!initialDate) {
      setError("Please select a date for the initial entry");
      return null;
    }

    if (isGold) {
      if (isNaN(goldGrams) || goldGrams <= 0) {
        setError("Gold weight must be greater than zero");
        return null;
      }
      if (isNaN(goldRate) || goldRate <= 0) {
        setError("Gold price must be greater than zero");
        return null;
      }
      if (isNaN(parsedWastage) || parsedWastage < 0) {
        setError("Wastage cannot be negative");
        return null;
      }
      if (isNaN(parsedGst) || parsedGst < 0) {
        setError("GST cannot be negative");
        return null;
      }
      if (initialDate > today) {
        setError("Initial date cannot be in the future");
        return null;
      }

      const breakdown = calculateGoldPurchase(
        goldGrams,
        goldRate,
        parsedWastage,
        parsedGst,
      );
      return {
        date: initialDate,
        value: breakdown.goldValue,
        units: goldGrams,
        cash_value: breakdown.totalPaid,
        details: {
          gold_price_per_gram: breakdown.pricePerGram,
          gold_value: breakdown.goldValue,
          wastage_percent: breakdown.wastagePercent,
          wastage_amount: breakdown.wastageAmount,
          gst_percent: breakdown.gstPercent,
          gst_amount: breakdown.gstAmount,
          total_paid: breakdown.totalPaid,
          purity,
        },
      };
    }

    const val = parseFloat(initialValue);
    const qty = assetType === REAL_ESTATE_TYPE ? 1 : parseFloat(initialUnits);

    if (isNaN(val) || val <= 0) {
      setError("Initial value must be greater than zero");
      return null;
    }
    if (isNaN(qty) || qty <= 0) {
      setError("Initial units must be greater than zero");
      return null;
    }
    if (initialDate > today) {
      setError("Initial date cannot be in the future");
      return null;
    }

    return { date: initialDate, value: val, units: qty };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const payload: AssetCreate = {
      name: name.trim(),
      asset_type: assetType,
      symbol: SEARCHABLE_TYPES.includes(assetType) ? symbol.trim() || undefined : undefined,
      notes: notes.trim() || undefined,
    };

    if (isGold) {
      payload.details = { purity };
    }

    if (assetType === REAL_ESTATE_TYPE) {
      const p = parseFloat(price);
      const d = parseFloat(documentation);
      const b = parseFloat(broker);
      if (isNaN(p) || p <= 0) {
        setError("Price is required and must be greater than zero");
        return;
      }
      payload.details = {
        price: p,
        documentation: isNaN(d) ? 0 : d,
        broker: isNaN(b) ? 0 : b,
      };
    }

    if (!isEditing) {
      const entry = validateInitialEntry();
      if (!entry && wantsInitialEntry()) {
        return;
      }
      if (entry) {
        payload.initial_date = entry.date;
        payload.initial_value = entry.value;
        payload.initial_units = entry.units;
        payload.initial_cash_value = entry.cash_value;
        payload.initial_entry_details = entry.details;
      }
    }

    setError("");
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-primary" />
          Basics
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Reliance Industries"
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="asset_type">Asset Type</Label>
            <AssetTypeSelect value={assetType} onChange={handleAssetTypeChange} />
          </div>

          {isGold && (
            <div className="space-y-2">
              <Label htmlFor="gold_purity">Gold Purity</Label>
              <Select
                id="gold_purity"
                value={purity}
                onChange={(e) => handlePurityChange(e.target.value as GoldPurity)}
              >
                {GOLD_PURITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.purityMark})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {SEARCHABLE_TYPES.includes(assetType) && (
            <div className="relative space-y-2">
              <Label htmlFor="symbol">
                {assetType === "stock" ? "Symbol" : "Scheme Code"}
              </Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={
                  assetType === "stock"
                    ? "Type stock name or symbol"
                    : "Type scheme name or code"
                }
                autoComplete="off"
              />
              {showSuggestions && searchType && symbol.length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-border/70 bg-card p-1 shadow-xl">
                  {searchLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Searching…
                    </div>
                  )}
                  {!searchLoading && suggestions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No results found
                    </div>
                  )}
                  {suggestions.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectSuggestion(item.symbol, item.name)}
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.symbol}
                        {item.exchange && ` · ${item.exchange}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {!isEditing && (
        <section className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isGold ? (
                <Gem className="h-4 w-4" />
              ) : assetType === REAL_ESTATE_TYPE ? (
                <Layers3 className="h-4 w-4" />
              ) : (
                <IndianRupee className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold">
                {isGold
                  ? "Gold purchase"
                  : assetType === REAL_ESTATE_TYPE
                    ? "Property cost"
                    : "Initial holding"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isGold
                  ? "Enter the invoice rate, weight, wastage and GST. Only the gold value counts in your portfolio; the total is paid from cash."
                  : assetType === REAL_ESTATE_TYPE
                    ? "Add the purchase cost so valuation starts correctly. This amount is paid from cash."
                    : "Optional — the amount is paid from your cash balance. Add cash first if needed."}
              </p>
            </div>
          </div>

          {isGold ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gold_grams">Weight (grams)</Label>
                  <Input
                    id="gold_grams"
                    type="number"
                    step="0.001"
                    value={initialUnits}
                    onChange={(e) => setInitialUnits(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gold_price">Gold price (₹/gram)</Label>
                  <Input
                    id="gold_price"
                    type="number"
                    step="0.01"
                    value={goldPricePerGram}
                    onChange={(e) => {
                      setGoldPricePerGram(e.target.value);
                      setGoldPriceTouched(true);
                    }}
                    placeholder={
                      currentGoldRate
                        ? String(currentGoldRate.price_per_gram)
                        : "e.g. 12815"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gold_wastage">Wastage (%)</Label>
                  <Input
                    id="gold_wastage"
                    type="number"
                    step="0.01"
                    value={wastagePercent}
                    onChange={(e) => setWastagePercent(e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gold_gst">GST (%)</Label>
                  <Input
                    id="gold_gst"
                    type="number"
                    step="0.01"
                    value={gstPercent}
                    onChange={(e) => setGstPercent(e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="initial_date">Purchase Date</Label>
                  <Input
                    id="initial_date"
                    type="date"
                    value={initialDate}
                    onChange={(e) => setInitialDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/70 px-3.5 py-3 text-sm">
                {!purchaseIsToday ? (
                  <p className="mb-3 border-b border-border/60 pb-3 text-xs text-muted-foreground">
                    Enter the gold rate printed on the invoice for this past
                    purchase.
                  </p>
                ) : currentGoldRate ? (
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 pb-3 text-xs text-muted-foreground">
                    <span>
                      Current {goldPurityLabel(purity)} rate:{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(currentGoldRate.price_per_gram)}/g
                      </span>{" "}
                      · {currentGoldRate.source} ·{" "}
                      {formatRelativeTime(currentGoldRate.fetched_at)}
                      {currentGoldRate.stale && " (stale)"}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      onClick={() => {
                        setGoldPricePerGram(
                          String(currentGoldRate.price_per_gram),
                        );
                        setGoldPriceTouched(false);
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Use current
                    </button>
                  </div>
                ) : goldRates.isLoading ? (
                  <p className="mb-3 border-b border-border/60 pb-3 text-xs text-muted-foreground">
                    Fetching the current {goldPurityLabel(purity)} rate…
                  </p>
                ) : goldRates.error ? (
                  <p className="mb-3 border-b border-border/60 pb-3 text-xs text-muted-foreground">
                    Live rate unavailable. Enter the gold price manually.
                  </p>
                ) : null}

                {goldBreakdown ? (
                  <dl className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Gold value ({goldGrams} g × {formatCurrency(goldRate)})
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
                      <dt className="text-muted-foreground">
                        GST ({parsedGst}%)
                      </dt>
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
                    Enter the weight and gold price to see the invoice
                    breakdown.
                  </p>
                )}
              </div>
            </>
          ) : assetType === REAL_ESTATE_TYPE ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 2632000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentation">Documentation / Registration</Label>
                <Input
                  id="documentation"
                  type="number"
                  step="0.01"
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                  placeholder="e.g. 34500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="broker">Broker / Other Charges</Label>
                <Input
                  id="broker"
                  type="number"
                  step="0.01"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_value">Total Value (INR)</Label>
                <Input
                  id="initial_value"
                  type="number"
                  step="0.01"
                  value={initialValue}
                  onChange={(e) => setInitialValue(e.target.value)}
                  placeholder="Total value"
                  readOnly
                  className="bg-muted/60"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="initial_date">Purchase Date</Label>
                <Input
                  id="initial_date"
                  type="date"
                  value={initialDate}
                  onChange={(e) => setInitialDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="initial_value">Value (INR)</Label>
                <Input
                  id="initial_value"
                  type="number"
                  step="0.01"
                  value={initialValue}
                  onChange={(e) => setInitialValue(e.target.value)}
                  placeholder="Total value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_units">Units / Quantity</Label>
                <Input
                  id="initial_units"
                  type="number"
                  step="0.001"
                  value={initialUnits}
                  onChange={(e) => setInitialUnits(e.target.value)}
                  placeholder="Quantity held"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_date" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  Date
                </Label>
                <Input
                  id="initial_date"
                  type="date"
                  value={initialDate}
                  onChange={(e) => setInitialDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEditing ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}
