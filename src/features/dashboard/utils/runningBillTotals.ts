export function getRunningBillTotals({
  tableBill,
  billedCafeTotal,
  sessionCafeTotal,
  billedAccessoriesTotal,
  sessionAccessoriesTotal,
  separatePlayerBills = false,
}: {
  tableBill: number;
  billedCafeTotal: number;
  sessionCafeTotal: number;
  billedAccessoriesTotal: number;
  sessionAccessoriesTotal: number;
  separatePlayerBills?: boolean;
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
        : tableBill + cafeTotal + accessoriesTotal,
  };
}
