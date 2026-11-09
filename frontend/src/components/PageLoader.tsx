import { TrendingUp } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-muted-foreground">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-primary/10" />
        <span className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-primary/70" />
        <TrendingUp className="h-5 w-5 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Loading</p>
        <p className="mt-1 text-xs text-muted-foreground">Just a moment…</p>
      </div>
    </div>
  );
}
