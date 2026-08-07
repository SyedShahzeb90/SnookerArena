import type { OrderItem } from "../types/menu";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  customerName: string;
  items: OrderItem[];
  onIncrease?: (
    menuItemId: string,
    saleOptionId?: string
  ) => void;
  onDecrease?: (
    menuItemId: string,
    saleOptionId?: string
  ) => void;
}

function OrderSummary({
  customerName,
  items,
  onIncrease,
  onDecrease,
}: Props) {
  const total = items.reduce(
    (sum, item) =>
      sum +
      item.price * item.quantity,
    0
  );

  return (
    <Card className="sticky top-0 rounded-xl border shadow-lg">
      <div className="border-b p-5">
        <h2 className="text-2xl font-bold">
          {customerName}
        </h2>

        <p className="text-sm text-gray-500">
          Current Order
        </p>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
        {items.length === 0 && (
          <div className="py-10 text-center text-gray-400">
            No items added yet.
          </div>
        )}

        {items.map((item) => (
          <div
            key={`${item.menuItemId}-${item.saleOptionId ?? "default"}`}
            className="rounded-lg border p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {item.name}
                </h3>

                <p className="text-sm text-gray-500">
                  Rs. {item.price}
                </p>
              </div>

              <div className="text-right font-bold">
                Rs.
                {" "}
                {item.price *
                  item.quantity}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-3">
              <Button
                size="icon"
                variant="destructive"
                onClick={() =>
                  onDecrease?.(
                    item.menuItemId,
                    item.saleOptionId
                  )
                }
              >
                −
              </Button>

              <span className="min-w-8 text-center text-lg font-bold">
                {item.quantity}
              </span>

              <Button
                size="icon"
                onClick={() =>
                  onIncrease?.(
                    item.menuItemId,
                    item.saleOptionId
                  )
                }
              >
                +
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t bg-slate-50 p-5">
        <div className="flex items-center justify-between text-2xl font-bold">
          <span>Total</span>

          <span className="text-green-600">
            Rs. {total}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default OrderSummary;
