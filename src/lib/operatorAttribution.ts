import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import type {
  OperatorSnapshot,
  TransactionAuditAction,
  TransactionAuditEvent,
} from "@/types/operatorAudit";

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function getActiveOperatorSnapshot(): OperatorSnapshot | undefined {
  const activeDay = useBusinessDayStore.getState().getActiveBusinessDay();
  if (!activeDay) return undefined;

  const operators = useClubSettingsStore.getState().getSettings().operators;
  const matchingOperator = activeDay.openedByOperatorId
    ? operators.find((operator) => operator.id === activeDay.openedByOperatorId)
    : operators.find(
        (operator) =>
          normalizeName(operator.name) === normalizeName(activeDay.openedBy),
      );

  return {
    // Older business days may not have an operator ID. Keep their current-day
    // actions attributable without relying on a mutable operator name later.
    operatorId:
      activeDay.openedByOperatorId ??
      matchingOperator?.id ??
      `business-day:${activeDay.id}`,
    operatorName: activeDay.openedBy,
  };
}

export function createOperatorAuditEvent(
  action: TransactionAuditAction,
  options: {
    occurredAt?: string;
    note?: string;
    operator?: OperatorSnapshot;
  } = {},
): TransactionAuditEvent | undefined {
  const operator = options.operator ?? getActiveOperatorSnapshot();
  if (!operator) return undefined;

  const occurredAt = options.occurredAt ?? new Date().toISOString();
  return {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    occurredAt,
    operator,
    note: options.note?.trim() || undefined,
  };
}

export function appendOperatorAuditEvent(
  events: TransactionAuditEvent[] | undefined,
  event: TransactionAuditEvent | undefined,
) {
  return event ? [...(events ?? []), event] : events ?? [];
}

export function getOperatorDisplayName(
  snapshot?: OperatorSnapshot,
  legacyName?: string,
) {
  return snapshot?.operatorName?.trim() || legacyName?.trim() || "\u2014";
}
