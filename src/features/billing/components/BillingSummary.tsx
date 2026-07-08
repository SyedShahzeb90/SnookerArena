import { calculateBill } from "../utils/calculateBill";

interface Props {
  gameAmount: number;
  cafeAmount: number;
  discount: number;
}

function BillingSummary({
  gameAmount,
  cafeAmount,
  discount,
}: Props) {
  const bill = calculateBill({
    gameAmount,
    cafeAmount,
    discount,
  });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex justify-between">
        <span>Game</span>
        <span>Rs. {gameAmount}</span>
      </div>

      <div className="flex justify-between">
        <span>Cafe</span>
        <span>Rs. {cafeAmount}</span>
      </div>

      <div className="flex justify-between">
        <span>Discount</span>
        <span>- Rs. {discount}</span>
      </div>

      <hr />

      <div className="flex justify-between text-lg font-bold">
        <span>Total</span>
        <span>Rs. {bill.total}</span>
      </div>
    </div>
  );
}

export default BillingSummary;