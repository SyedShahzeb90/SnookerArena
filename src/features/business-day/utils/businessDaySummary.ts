import type { PendingBill } from "@/features/billing/store/checkoutStore";
import {
  getPlayerCafeAmount,
  hasPlayerName,
} from "@/features/billing/utils/playerBillIdentity";
import type { Expense } from "@/features/expenses/types/expense";
import { isActiveExpense } from "@/features/expenses/utils/expenseHelpers";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import type { Sale } from "@/features/sales/types/sale";

import type {
  BusinessDay,
  BusinessDaySummary,
} from "../types/businessDay";

export function getRemainingPendingBillTotal(
  bill: PendingBill
) {
  if (bill.status === "cancelled") return 0;

  const session = bill.session;
  if (!session.endTime) return 0;

  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType: bill.tableType,
    startTime: new Date(session.startTime),
    endTime: new Date(session.endTime),
  });
  const players = [
    session.player1,
    session.player2,
    session.player3,
    session.player4,
  ].filter(Boolean);
  const paidPlayers =
    bill.paidPlayerNames ?? [];

  if (paidPlayers.length > 0) {
    const payerName =
      session.payerName ??
      session.loserName ??
      players[0];

    return players.reduce((total, name) => {
      if (
        !name ||
        hasPlayerName(paidPlayers, name)
      ) {
        return total;
      }

      const cafeAmount =
        getPlayerCafeAmount(session, name);
      const tableAmount =
        payerName === name
          ? pricing.gameAmount
          : 0;

      return total + cafeAmount + tableAmount;
    }, 0);
  }

  return calculateBill({
    gameAmount: pricing.gameAmount,
    cafeAmount: session.cafeAmount,
    discount: session.discount,
  }).total;
}

export function calculateBusinessDaySummary({
  day,
  sales,
  expenses,
  pendingBills,
}: {
  day: BusinessDay;
  sales: Sale[];
  expenses: Expense[];
  pendingBills: PendingBill[];
}): BusinessDaySummary {
  const daySales = sales.filter(
    (sale) =>
      sale.activeBusinessDayId === day.id
  );
  const dayExpenses = expenses.filter(
    (expense) =>
      expense.activeBusinessDayId === day.id &&
      isActiveExpense(expense)
  );

  const salesTotals = daySales.reduce(
    (totals, sale) => {
      const paymentTotals =
        sale.paymentSplits?.length
          ? sale.paymentSplits.reduce(
              (summary, split) => ({
                ...summary,
                [split.method]:
                  summary[split.method] +
                  split.amount,
              }),
              {
                cash: 0,
                card: 0,
                jazzcash: 0,
                easypaisa: 0,
              }
            )
          : {
              cash:
                sale.paymentMethod === "cash"
                  ? sale.grandTotal
                  : 0,
              card:
                sale.paymentMethod === "card"
                  ? sale.grandTotal
                  : 0,
              jazzcash:
                sale.paymentMethod ===
                "jazzcash"
                  ? sale.grandTotal
                  : 0,
              easypaisa:
                sale.paymentMethod ===
                "easypaisa"
                  ? sale.grandTotal
                  : 0,
            };

      return {
        totalSales:
          totals.totalSales +
          sale.grandTotal,
        tableSales:
          totals.tableSales +
          sale.tableAmount,
        cafeSales:
          totals.cafeSales +
          sale.cafeAmount,
        cashSales:
          totals.cashSales +
          paymentTotals.cash,
        cardSales:
          totals.cardSales +
          paymentTotals.card,
        jazzCashSales:
          totals.jazzCashSales +
          paymentTotals.jazzcash,
        easypaisaSales:
          totals.easypaisaSales +
          paymentTotals.easypaisa,
        completedPaymentsCount:
          totals.completedPaymentsCount + 1,
      };
    },
    {
      totalSales: 0,
      tableSales: 0,
      cafeSales: 0,
      cashSales: 0,
      cardSales: 0,
      jazzCashSales: 0,
      easypaisaSales: 0,
      completedPaymentsCount: 0,
    }
  );

  const expenseTotals = dayExpenses.reduce(
    (totals, expense) => ({
      totalExpenses:
        totals.totalExpenses +
        expense.amount,
      cashExpenses:
        totals.cashExpenses +
        (!expense.paymentMethod ||
        expense.paymentMethod === "cash"
          ? expense.amount
          : 0),
      expenseCount:
        totals.expenseCount + 1,
    }),
    {
      totalExpenses: 0,
      cashExpenses: 0,
      expenseCount: 0,
    }
  );

  const openPendingBills =
    pendingBills.filter(
      (bill) =>
        bill.status !== "cancelled"
    );
  const pendingBillsAmount =
    openPendingBills.reduce(
      (total, bill) =>
        total + getRemainingPendingBillTotal(bill),
      0
    );
  const expectedCash =
    day.openingCash +
    salesTotals.cashSales -
    expenseTotals.cashExpenses;

  return {
    ...salesTotals,
    ...expenseTotals,
    pendingBillsCount: openPendingBills.length,
    pendingBillsAmount,
    expectedCash,
    netProfit:
      salesTotals.totalSales -
      expenseTotals.totalExpenses,
  };
}
