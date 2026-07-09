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
  const subtotal =
    gameAmount + cafeAmount;

  return {
    subtotal,
    total: Math.max(
      subtotal - discount,
      0
    ),
  };
}