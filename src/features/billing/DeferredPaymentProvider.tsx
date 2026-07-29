import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useToast } from "@/components/ui/toast";

const PAYMENT_UNDO_WINDOW_MS = 5_000;

interface DeferredPaymentInput {
  key: string;
  label: string;
  commit: () => void;
  onUndo?: () => void;
}

interface PendingPayment {
  timer: number;
}

interface DeferredPaymentApi {
  pendingPaymentKeys: ReadonlySet<string>;
  schedulePayment: (input: DeferredPaymentInput) => boolean;
}

const DeferredPaymentContext = createContext<DeferredPaymentApi | null>(null);

export function DeferredPaymentProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const pendingRef = useRef(new Map<string, PendingPayment>());
  const [pendingPaymentKeys, setPendingPaymentKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const syncPendingKeys = useCallback(() => {
    setPendingPaymentKeys(new Set(pendingRef.current.keys()));
  }, []);

  const schedulePayment = useCallback(
    ({ key, label, commit, onUndo }: DeferredPaymentInput) => {
      if (pendingRef.current.has(key)) return false;

      const finalize = () => {
        const pending = pendingRef.current.get(key);
        if (!pending) return;
        pendingRef.current.delete(key);
        syncPendingKeys();
        commit();
      };

      const undo = () => {
        const pending = pendingRef.current.get(key);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        pendingRef.current.delete(key);
        syncPendingKeys();
        onUndo?.();
      };

      const timer = window.setTimeout(finalize, PAYMENT_UNDO_WINDOW_MS);
      toast.success({
        title: "Payment Received Successfully",
        description: `${label}. This action will be finalized in 5 seconds.`,
        actionLabel: "Undo",
        onAction: undo,
        duration: PAYMENT_UNDO_WINDOW_MS,
        placement: "bottom-right",
        showCountdown: true,
        pauseOnHover: false,
      });

      pendingRef.current.set(key, { timer });
      syncPendingKeys();
      return true;
    },
    [syncPendingKeys, toast],
  );

  const value = useMemo(
    () => ({ pendingPaymentKeys, schedulePayment }),
    [pendingPaymentKeys, schedulePayment],
  );

  return (
    <DeferredPaymentContext.Provider value={value}>
      {children}
    </DeferredPaymentContext.Provider>
  );
}

export function useDeferredPayment() {
  const context = useContext(DeferredPaymentContext);
  if (!context) {
    throw new Error("useDeferredPayment must be used within DeferredPaymentProvider.");
  }
  return context;
}
