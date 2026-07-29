import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissOnAction?: boolean;
  duration?: number;
  placement?: "top-right" | "bottom-right";
  showCountdown?: boolean;
  pauseOnHover?: boolean;
}

interface ToastRecord extends ToastOptions {
  id: number;
  revision: number;
  variant: ToastVariant;
  dismissRequest: number;
}

interface ToastApi {
  success: (options: ToastOptions) => number;
  info: (options: ToastOptions) => number;
  warning: (options: ToastOptions) => number;
  error: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE_TOASTS = 4;
const EXIT_DURATION = 250;
const defaultDurations: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 7000,
};

const variantStyles: Record<
  ToastVariant,
  {
    accent: string;
    icon: string;
    iconBackground: string;
    progress: string;
    Icon: typeof CheckCircle2;
  }
> = {
  success: {
    accent: "border-l-emerald-500",
    icon: "text-emerald-700 dark:text-emerald-300",
    iconBackground: "bg-emerald-100 dark:bg-emerald-950",
    progress: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  info: {
    accent: "border-l-blue-500",
    icon: "text-blue-700 dark:text-blue-300",
    iconBackground: "bg-blue-100 dark:bg-blue-950",
    progress: "bg-blue-500",
    Icon: Info,
  },
  warning: {
    accent: "border-l-amber-500",
    icon: "text-amber-700 dark:text-amber-300",
    iconBackground: "bg-amber-100 dark:bg-amber-950",
    progress: "bg-amber-500",
    Icon: AlertTriangle,
  },
  error: {
    accent: "border-l-red-500",
    icon: "text-red-700 dark:text-red-300",
    iconBackground: "bg-red-100 dark:bg-red-950",
    progress: "bg-red-500",
    Icon: AlertCircle,
  },
};

const ToastContext = createContext<ToastApi | null>(null);

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [countdownProgress, setCountdownProgress] = useState(100);
  const timeoutRef = useRef<number | undefined>(undefined);
  const countdownRef = useRef<number | undefined>(undefined);
  const exitTimeoutRef = useRef<number | undefined>(undefined);
  const remainingRef = useRef(
    toast.duration ?? defaultDurations[toast.variant],
  );
  const timerStartedAtRef = useRef(0);
  const closingRef = useRef(false);
  const styles = variantStyles[toast.variant];
  const { Icon } = styles;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current !== undefined) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = undefined;
    }
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimer();
    clearCountdown();
    setVisible(false);
    exitTimeoutRef.current = window.setTimeout(
      () => onDismiss(toast.id),
      EXIT_DURATION,
    );
  }, [clearCountdown, clearTimer, onDismiss, toast.id]);

  const startTimer = useCallback(() => {
    clearTimer();
    timerStartedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(
      close,
      Math.max(0, remainingRef.current),
    );
  }, [clearTimer, close]);

  useEffect(() => {
    closingRef.current = false;
    remainingRef.current = toast.duration ?? defaultDurations[toast.variant];
    const countdownDuration = remainingRef.current;
    const countdownStartedAt = Date.now();
    if (toast.showCountdown) {
      setCountdownProgress(100);
      setCountdownSeconds(Math.max(1, Math.ceil(remainingRef.current / 1000)));
      countdownRef.current = window.setInterval(() => {
        const remaining = Math.max(
          0,
          remainingRef.current - (Date.now() - countdownStartedAt),
        );
        setCountdownProgress(
          countdownDuration > 0 ? (remaining / countdownDuration) * 100 : 0,
        );
        setCountdownSeconds(Math.max(1, Math.ceil(remaining / 1000)));
      }, 250);
    } else {
      setCountdownProgress(100);
      setCountdownSeconds(null);
    }
    const animationFrame = window.requestAnimationFrame(() => setVisible(true));
    startTimer();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      clearTimer();
      clearCountdown();
      if (exitTimeoutRef.current !== undefined) {
        window.clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [
    clearCountdown,
    clearTimer,
    startTimer,
    toast.duration,
    toast.revision,
    toast.showCountdown,
    toast.variant,
  ]);

  useEffect(() => {
    if (toast.dismissRequest > 0) close();
  }, [close, toast.dismissRequest]);

  const pauseTimer = () => {
    if (toast.pauseOnHover === false) return;
    if (timeoutRef.current === undefined) return;
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (Date.now() - timerStartedAtRef.current),
    );
    clearTimer();
  };

  const resumeTimer = () => {
    if (toast.pauseOnHover === false) return;
    if (!closingRef.current) startTimer();
  };

  const runAction = () => {
    toast.onAction?.();
    if (toast.dismissOnAction !== false) close();
  };

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white p-4 text-slate-950 shadow-lg transition-[opacity,transform] duration-300 ease-out dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
        styles.accent,
        visible ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          styles.iconBackground,
        )}
      >
        <Icon className={cn("h-4.5 w-4.5", styles.icon)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-5">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {toast.description}
          </p>
        )}
        {toast.actionLabel && toast.onAction && (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className={cn(
                "text-sm font-semibold underline decoration-transparent underline-offset-2 outline-none transition hover:decoration-current focus-visible:decoration-current",
                styles.icon,
              )}
              onClick={runAction}
            >
              {toast.actionLabel}
            </button>
            {countdownSeconds !== null && (
              <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                {countdownSeconds}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={`Dismiss ${toast.title} notification`}
        className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        onClick={close}
      >
        <X className="h-4 w-4" />
      </button>
      {toast.showCountdown && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className={cn(
              "h-full transition-[width] duration-200 ease-linear",
              styles.progress,
            )}
            style={{ width: `${countdownProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (variant: ToastVariant, options: ToastOptions) => {
      nextIdRef.current += 1;
      const nextId = nextIdRef.current;

      setToasts((current) => {
        const duplicate = current.find(
          (toast) =>
            toast.variant === variant &&
            toast.title === options.title &&
            toast.description === options.description,
        );

        if (duplicate) {
          const refreshed: ToastRecord = {
            ...duplicate,
            ...options,
            revision: duplicate.revision + 1,
            dismissRequest: 0,
          };
          return [
            refreshed,
            ...current.filter((toast) => toast.id !== duplicate.id),
          ].slice(0, MAX_VISIBLE_TOASTS);
        }

        return [
          {
            ...options,
            id: nextId,
            revision: 0,
            variant,
            dismissRequest: 0,
          },
          ...current,
        ].slice(0, MAX_VISIBLE_TOASTS);
      });

      return nextId;
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]')) return;
      setToasts((current) => {
        if (current.length === 0) return current;
        return current.map((toast, index) =>
          index === 0
            ? { ...toast, dismissRequest: toast.dismissRequest + 1 }
            : toast,
        );
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (options) => notify("success", options),
      info: (options) => notify("info", options),
      warning: (options) => notify("warning", options),
      error: (options) => notify("error", options),
      dismiss,
    }),
    [dismiss, notify],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[calc(100%-2rem)] max-w-[360px] flex-col gap-2 sm:right-6 sm:top-24"
      >
        {toasts.filter((toast) => toast.placement !== "bottom-right").map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
      <div
        aria-label="Payment notifications"
        className="pointer-events-none fixed bottom-5 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-[380px] flex-col-reverse gap-2 sm:bottom-6 sm:right-6"
      >
        {toasts.filter((toast) => toast.placement === "bottom-right").map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
