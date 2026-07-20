export function getRunningBillTotals({
  tableBill,
  billedCafeTotal,
  sessionCafeTotal,
  billedAccessoriesTotal,
  sessionAccessoriesTotal,
  separatePlayerBills = false,
  openBillTotal = 0,
  currentSessionBilledCafeTotal = 0,
  currentSessionBilledAccessoriesTotal = 0,
  openBillIncludesBilledTotals = false,
}: {
  tableBill: number;
  billedCafeTotal: number;
  sessionCafeTotal: number;
  billedAccessoriesTotal: number;
  sessionAccessoriesTotal: number;
  separatePlayerBills?: boolean;
  openBillTotal?: number;
  currentSessionBilledCafeTotal?: number;
  currentSessionBilledAccessoriesTotal?: number;
  openBillIncludesBilledTotals?: boolean;
}) {
  const cafeTotal = Math.max(
    billedCafeTotal,
    sessionCafeTotal
  );
  const accessoriesTotal = Math.max(
    billedAccessoriesTotal,
    sessionAccessoriesTotal
  );

  return {
    cafeTotal,
    accessoriesTotal,
    currentBill:
      separatePlayerBills
        ? tableBill
        : tableBill +
          openBillTotal +
          Math.max(
            0,
            (openBillIncludesBilledTotals
              ? sessionCafeTotal
              : cafeTotal) - currentSessionBilledCafeTotal
          ) +
          Math.max(
            0,
            (openBillIncludesBilledTotals
              ? sessionAccessoriesTotal
              : accessoriesTotal) -
              currentSessionBilledAccessoriesTotal
          ),
  };
}
