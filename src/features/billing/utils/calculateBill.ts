export interface BillInput {
  gameAmount: number;
  cafeAmount: number;
  discount: number;
}

export interface BillResult {
  subtotal: number;
  total: number;
}

export function calculateBill({
  gameAmount,
  cafeAmount,
  discount,
}: BillInput): BillResult {
  const subtotal = gameAmount + cafeAmount;

  const total = Math.max(
    subtotal - discount,
    0
  );

  return {
    subtotal,
    total,
  };
}