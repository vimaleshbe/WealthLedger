import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  LogOut,
  TrendingUp,
  Banknote,
  Building2,
  Landmark,
  PiggyBank,
} from "lucide-react";
import NavLink from "./components/NavLink";
import SyncButton from "./components/SyncButton";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ui/toast";
import { useAuth } from "./components/AuthProvider";
import Login from "./pages/Login";
import { cn } from "./lib/utils";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AssetList = lazy(() => import("./pages/AssetList"));
const AssetFormPage = lazy(() => import("./pages/AssetFormPage"));
const AssetView = lazy(() => import("./pages/AssetView"));
const Cash = lazy(() => import("./pages/Cash"));
const FD = lazy(() => import("./pages/FD"));
const FDDetail = lazy(() => import("./pages/FDDetail"));
const Retirement = lazy(() => import("./pages/Retirement"));
const RetirementAccountPage = lazy(
  () => import("./pages/RetirementAccountPage"),
);
const Transactions = lazy(() => import("./pages/Transactions"));

function RouteProgress() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(12);

    const frame = requestAnimationFrame(() => setProgress(72));
    const complete = setTimeout(() => setProgress(100), 280);
    const hide = setTimeout(() => setVisible(false), 640);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(complete);
      clearTimeout(hide);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 shadow-[0_0_12px_rgba(79,70,229,0.45)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-primary/10" />
        <span className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-primary/70" />
        <TrendingUp className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Loading</p>
        <p className="mt-1 text-xs text-muted-foreground">Preparing your portfolio…</p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function Header() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void signOut().finally(() => setSigningOut(false));
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-transform duration-200 group-hover:scale-105">
            <TrendingUp className="h-5 w-5" />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-[15px] font-bold tracking-tight">WealthLedger</span>
            <span className="mt-1 hidden text-[11px] font-medium text-muted-foreground sm:block">
              Your wealth, in one place
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1 shadow-sm">
            <NavLink to="/" end>
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden xl:inline">Dashboard</span>
            </NavLink>
            <NavLink to="/assets">
              <Wallet className="h-4 w-4" />
              <span className="hidden xl:inline">Assets</span>
            </NavLink>
            <NavLink to="/cash">
              <Banknote className="h-4 w-4" />
              <span className="hidden xl:inline">Cash</span>
            </NavLink>
            <NavLink to="/fd">
              <Building2 className="h-4 w-4" />
              <span className="hidden xl:inline">FD</span>
            </NavLink>
            <span className="flex xl:hidden">
              <NavLink to="/retirement">
                <Landmark className="h-4 w-4" />
                <span className="sr-only">Retirement</span>
              </NavLink>
            </span>
            <span className="hidden xl:flex">
              <NavLink to="/pf">
                <Landmark className="h-4 w-4" />
                <span>PF</span>
              </NavLink>
            </span>
            <span className="hidden xl:flex">
              <NavLink to="/ppf">
                <Wallet className="h-4 w-4" />
                <span>PPF</span>
              </NavLink>
            </span>
            <span className="hidden xl:flex">
              <NavLink to="/nps">
                <PiggyBank className="h-4 w-4" />
                <span>NPS</span>
              </NavLink>
            </span>
            <NavLink to="/transactions">
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden xl:inline">Transactions</span>
            </NavLink>
          </nav>
          <SyncButton />
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            title={user ? `Sign out (${user.username})` : "Sign out"}
            aria-label="Sign out"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2.5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function App() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    const pageTitle =
      pathname === "/"
        ? "Dashboard"
        : pathname === "/assets"
          ? "Assets"
          : pathname === "/retirement"
            ? "Retirement"
            : pathname === "/pf"
              ? "PF"
              : pathname === "/ppf"
                ? "PPF"
                : pathname === "/nps"
                  ? "NPS"
                  : pathname === "/cash"
                    ? "Cash"
                    : pathname === "/fd"
                      ? "Fixed Deposits"
                      : /^\/fd\/\d+$/.test(pathname)
                        ? "FD Details"
                        : pathname === "/transactions"
                          ? "Transactions"
                          : pathname === "/assets/new"
                            ? "Add Asset"
                            : /^\/assets\/\d+$/.test(pathname)
                              ? "Asset Details"
                              : /^\/assets\/\d+\/edit$/.test(pathname)
                                ? "Edit Asset"
                                : pathname === "/login"
                                  ? "Sign in"
                                  : "WealthLedger";

    document.title = `${pageTitle} · WealthLedger`;
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <RouteLoader />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <RouteProgress />
        <ScrollToTop />
        <Header />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <ErrorBoundary>
            <Suspense fallback={<RouteLoader />}>
              <div key={pathname} className="animate-page-in">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/cash" element={<Cash />} />
                  <Route path="/fd" element={<FD />} />
                  <Route path="/fd/:id" element={<FDDetail />} />
                  <Route path="/assets" element={<AssetList />} />
                  <Route path="/assets/new" element={<AssetFormPage />} />
                  <Route path="/assets/:id" element={<AssetView />} />
                  <Route path="/assets/:id/edit" element={<AssetFormPage />} />
                  <Route path="/retirement" element={<Retirement />} />
                  <Route
                    path="/pf"
                    element={<RetirementAccountPage assetType="pf" />}
                  />
                  <Route
                    path="/ppf"
                    element={<RetirementAccountPage assetType="ppf" />}
                  />
                  <Route
                    path="/nps"
                    element={<RetirementAccountPage assetType="nps" />}
                  />
                </Routes>
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="border-t border-border/60 bg-background/40">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
            <p>Private &amp; self-hosted — your data never leaves your server.</p>
            <p>© {new Date().getFullYear()} WealthLedger</p>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

export default App;
