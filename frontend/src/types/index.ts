export type AssetType =
  | "stock"
  | "mutual_fund"
  | "nps"
  | "ppf"
  | "cash"
  | "bank_balance"
  | "pf"
  | "physical_gold"
  | "real_estate";

export type EntryType = "buy" | "sell" | "deposit" | "withdrawal";

export type Category =
  | "equity"
  | "debt"
  | "retirement"
  | "cash"
  | "real_estate"
  | "commodities";

export interface Asset {
  id: number;
  name: string;
  asset_type: AssetType;
  category: Category;
  symbol?: string;
  details?: Record<string, unknown>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetEntry {
  id: number;
  asset_id: number;
  date: string;
  value: number;
  units: number;
  entry_type: EntryType;
  affects_cash: boolean;
  cash_value?: number | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetCreate {
  name: string;
  asset_type: AssetType;
  symbol?: string;
  details?: Record<string, unknown>;
  notes?: string;
  initial_date?: string;
  initial_value?: number;
  initial_units?: number;
}

export interface EntryCreate {
  date: string;
  value: number;
  units: number;
  entry_type?: EntryType;
  affects_cash?: boolean;
  notes?: string;
}

export interface Transaction {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_type: AssetType;
  date: string;
  value: number;
  units: number;
  entry_type: EntryType;
  affects_cash: boolean;
  cash_value?: number | null;
  notes?: string;
}

export interface AssetValuation {
  asset_id: number;
  invested_value: number;
  current_value: number;
  change: number;
  change_percent: number;
  total_units: number;
  latest_price: number | null;
  price_source: string | null;
  price_fetched_at: string | null;
}

export interface XirrResponse {
  xirr: number | null;
  xirr_percent: number | null;
}

export interface DashboardSummary {
  total_value: number;
  portfolio_value: number;
  net_worth: number;
  cash_value: number;
  cash_asset_id: number | null;
  currency: string;
  asset_count: number;
  last_updated: string;
}

export interface CashSummary {
  asset_id: number;
  balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_buys: number;
  total_sells: number;
  currency: string;
  last_updated: string;
}

export interface CashMovementCreate {
  date: string;
  value: number;
  notes?: string;
}

export interface AllocationItem {
  category?: string;
  asset_type?: string;
  value: number;
  percentage: number;
}

export interface AllocationResponse {
  by_category: AllocationItem[];
  by_asset_type: AllocationItem[];
}

export interface TrendPoint {
  date: string;
  total_value: number;
}

export interface TrendResponse {
  currency: string;
  points: TrendPoint[];
}
