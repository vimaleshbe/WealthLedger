import { RefreshCw } from "lucide-react";
import { useIsMarketSyncing, useMarketSync, useSyncStatus } from "../api/sync";
import { useToast } from "./ui/toast";
import { cn, formatRelativeTime } from "../lib/utils";

export default function SyncButton() {
  const { data } = useSyncStatus();
  const sync = useMarketSync();
  const isSyncing = useIsMarketSyncing();
  const { success, error } = useToast();

  const lastSync = data?.last_sync_at;
  const exactTime = lastSync
    ? new Date(lastSync).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  const handleClick = () => {
    sync.mutate(undefined, {
      onSuccess: () => success("Market data synced successfully"),
      onError: (err: Error) =>
        error(err.message || "Failed to sync market data"),
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSyncing}
      title={lastSync ? `Last synced: ${exactTime}` : "Never synced"}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/70 px-2.5 py-1.5 text-left shadow-sm transition-all duration-200",
        "hover:border-primary/30 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-70 sm:px-3",
      )}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <RefreshCw
          className={cn("h-4 w-4", isSyncing && "animate-spin")}
        />
        {!isSyncing && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-card",
              lastSync ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-semibold text-foreground">
          {isSyncing ? "Syncing…" : "Sync"}
        </span>
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">
          Last: {isSyncing ? "in progress" : formatRelativeTime(lastSync)}
        </span>
      </span>
    </button>
  );
}
