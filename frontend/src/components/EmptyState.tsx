import { Wallet, Plus, Sparkles, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export default function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
        <Wallet className="h-7 w-7" />
      </div>
      <h2 className="relative mt-5 text-2xl font-bold tracking-tight">
        Welcome to your portfolio
      </h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Start by adding money to cash. Then buy stocks, mutual funds, gold or
        property — purchases are paid from cash and sales return to it. PF, PPF
        and NPS live in the Retirement tab.
      </p>
      <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link to="/cash">
          <Button size="lg">
            <Banknote className="h-4 w-4" />
            Add cash first
          </Button>
        </Link>
        <Link to="/assets">
          <Button size="lg" variant="outline">
            <Plus className="h-4 w-4" />
            Add an asset
          </Button>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Private by design
        </span>
      </div>
    </div>
  );
}
