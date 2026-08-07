import {
  isActionableCustomerBill,
} from "@/features/customers/store/customerAccountStore";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";
import type { Table } from "@/types/table";

export function getCollectPaymentPendingSummary(
  customerAccounts: CustomerAccount[],
  tables: Table[],
) {
  const runningSessions = tables
    .filter(
      (table) =>
        table.session &&
        (table.status === "running" || table.status === "paused"),
    )
    .map((table) => table.session!);
  const runningCustomerIds = new Set(
    runningSessions.flatMap((session) =>
      [
        session.player1CustomerId,
        session.player2CustomerId,
        session.player3CustomerId,
        session.player4CustomerId,
        ...(session.extraPlayerCustomerIds ?? []),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const runningSessionIds = new Set(
    runningSessions.map((session) => session.id),
  );

  const visibleBills = customerAccounts.filter((account) => {
    if (!isActionableCustomerBill(account) || account.grandTotal <= 0) {
      return false;
    }

    const accountSessionIds = new Set(
      [
        ...account.gameCharges,
        ...account.cafeCharges,
        ...(account.accessoryCharges ?? []),
      ]
        .map((charge) => charge.sessionId)
        .filter(Boolean),
    );

    return (
      !runningCustomerIds.has(account.id) &&
      !Array.from(accountSessionIds).some((sessionId) =>
        runningSessionIds.has(sessionId),
      )
    );
  });
  const seen = new Set<string>();

  const uniqueBills = visibleBills.filter((account) => {
    const key = [
      getBillPrimaryLabel(account),
      getBillTableLabel(account),
      account.customerName.trim().toLowerCase(),
      account.grandTotal,
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    count: uniqueBills.length,
    amount: uniqueBills.reduce(
      (total, account) => total + account.grandTotal,
      0,
    ),
  };
}

export function getCollectPaymentPendingCount(
  customerAccounts: CustomerAccount[],
  tables: Table[],
) {
  return getCollectPaymentPendingSummary(customerAccounts, tables).count;
}
