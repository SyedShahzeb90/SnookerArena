export interface OperatorSnapshot {
  operatorId: string;
  operatorName: string;
}

export type TransactionAuditAction =
  | "bill_created"
  | "payment_received"
  | "payment_method_corrected"
  | "credit_issued"
  | "credit_recovered"
  | "cancelled"
  | "settled_by_advance";

export interface TransactionAuditEvent {
  id: string;
  action: TransactionAuditAction;
  occurredAt: string;
  operator: OperatorSnapshot;
  note?: string;
}
