import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const iconStyles = {
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  error: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400",
  info: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
};

const accentStyles = {
  success: "before:bg-emerald-500",
  error: "before:bg-red-500",
  info: "before:bg-blue-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => remove(id), 4200),
      );
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toast: add,
        success: (message: string) => add(message, "success"),
        error: (message: string) => add(message, "error"),
      }}
    >
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-xl animate-slide-up",
                "before:absolute before:inset-y-0 before:left-0 before:w-1",
                accentStyles[toast.type],
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  iconStyles[toast.type],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="flex-1 pt-1 text-sm font-medium leading-snug text-foreground">
                {toast.message}
              </p>
              <button
                onClick={() => remove(toast.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
