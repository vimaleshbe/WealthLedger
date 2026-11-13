import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  PiggyBank,
  Plus,
  Percent,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import ErrorState from "../components/ErrorState";
import FDForm from "../components/FDForm";
import PageHeader from "../components/PageHeader";
import { useCreateFd, useFds } from "../api/fd";
import { useToast } from "../components/ui/toast";
import { fdStatus, tenureLabel } from "../lib/fd";
import { cn, formatCurrency, formatDate } from "../lib/utils";
import type { AssetCreate, FDSummary } from "../types";

function FDStatusBadge({ fd }: { fd: FDSummary }) {
  const status = fdStatus(fd.days_remaining);
  return (
    <Badge
      className={cn(
        "border-transparent",
        status === "Matured"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          : status === "Active"
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

function FDCard({ fd }: { fd: FDSummary }) {
  return (
    <Link to={`/fd/${fd.asset_id}`} className="block h-full">
      <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        <CardContent className="relative flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Fixed Deposit
              </p>
              <p className="mt-1.5 truncate text-xl font-bold tracking-tight">
                {fd.name}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight">
                {formatCurrency(fd.balance)}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/10 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Principal
              </p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatCurrency(fd.principal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Interest
              </p>
              <p className="mt-0.5 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(fd.interest)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Rate
              </p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {fd.interest_rate !== null ? `${fd.interest_rate}%` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {fd.tenure_months
                  ? tenureLabel(fd.tenure_months)
                  : "Tenure not set"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              <span>
                {fd.maturity_date
                  ? `Matures ${formatDate(fd.maturity_date)}`
                  : "Maturity not set"}
              </span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <FDStatusBadge fd={fd} />
            <span className="inline-flex items-center gap-0.5 font-medium">
              Open
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function FD() {
  const { data, isLoading, error, refetch } = useFds();
  const createFd = useCreateFd();
  const { success, error: showError } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit = (payload: AssetCreate) => {
    createFd.mutate(payload, {
      onSuccess: () => {
        setDialogOpen(false);
        success("FD created.");
      },
      onError: (err: Error) => showError(err.message || "Could not create the FD."),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[140px] rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-[260px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState onRetry={refetch} />;
  }

  const totalBalance = data.reduce((sum, fd) => sum + fd.balance, 0);
  const totalPrincipal = data.reduce((sum, fd) => sum + fd.principal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Deposits"
        description="Multiple FDs, each with its own tenure, interest rate and interest credits."
      >
        <Badge variant="outline" className="py-1">
          {data.length} {data.length === 1 ? "FD" : "FDs"}
        </Badge>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add FD
        </Button>
      </PageHeader>

      <Card className="relative overflow-hidden border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-indigo-500/[0.06]" />
        <CardContent className="relative flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Total FD Balance
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Principal
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totalPrincipal)}
            </p>
          </div>
        </CardContent>
      </Card>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/60" />
          <h2 className="mt-4 text-lg font-semibold">No fixed deposits</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first FD with its principal, tenure and annual interest
            rate. You can add as many FDs as you want.
          </p>
          <Button className="mt-5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add FD
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((fd) => (
            <FDCard key={fd.asset_id} fd={fd} />
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add Fixed Deposit"
        description="Each FD keeps its own principal, tenure and interest rate."
      >
        <FDForm
          onSubmit={handleSubmit}
          onCancel={() => setDialogOpen(false)}
          isSubmitting={createFd.isPending}
        />
      </Dialog>
    </div>
  );
}
