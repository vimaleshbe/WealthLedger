import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, IndianRupee, Layers3 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import AssetTypeSelect from "./AssetTypeSelect";
import { useSymbolSearch } from "../api/search";
import { todayISO } from "../lib/utils";
import type { AssetCreate, AssetType } from "../types";

interface AssetFormProps {
  initial?: Partial<AssetCreate>;
  onSubmit: (data: AssetCreate) => void;
  onCancel: () => void;
}

const SEARCHABLE_TYPES: AssetType[] = ["stock", "mutual_fund"];
const REAL_ESTATE_TYPE: AssetType = "real_estate";

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
  const initialDetails = (initial?.details ?? {}) as Record<string, string>;
  const [price, setPrice] = useState(initialDetails.price ?? "");
  const [documentation, setDocumentation] = useState(initialDetails.documentation ?? "");
  const [broker, setBroker] = useState(initialDetails.broker ?? "");

  const searchType = SEARCHABLE_TYPES.includes(assetType)
    ? (assetType as "stock" | "mutual_fund")
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

  const handleAssetTypeChange = (type: AssetType) => {
    setAssetType(type);
    setSymbol("");
    setShowSuggestions(false);
    if (type !== REAL_ESTATE_TYPE) {
      setPrice("");
      setDocumentation("");
      setBroker("");
    }
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

  const wantsInitialEntry = () =>
    initialValue.trim() !== "" ||
    (assetType !== REAL_ESTATE_TYPE && initialUnits.trim() !== "");

  const validateInitialEntry = (): { date?: string; value?: number; units?: number } | null => {
    if (isEditing) return null;

    if (!initialDate) {
      setError("Please select a date for the initial entry");
      return null;
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

          {SEARCHABLE_TYPES.includes(assetType) && (
            <div className="relative space-y-2">
              <Label htmlFor="symbol">
                {assetType === "mutual_fund" ? "Scheme Code" : "Symbol"}
              </Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={
                  assetType === "mutual_fund"
                    ? "Type scheme name or code"
                    : "Type stock name or symbol"
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
              {assetType === REAL_ESTATE_TYPE ? (
                <Layers3 className="h-4 w-4" />
              ) : (
                <IndianRupee className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold">
                {assetType === REAL_ESTATE_TYPE ? "Property cost" : "Initial holding"}
              </p>
              <p className="text-xs text-muted-foreground">
                {assetType === REAL_ESTATE_TYPE
                  ? "Add the purchase cost so valuation starts correctly."
                  : "Optional — you can add purchases later from the asset page."}
              </p>
            </div>
          </div>

          {assetType === REAL_ESTATE_TYPE ? (
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
