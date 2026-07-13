import type { OrderItem } from "../types/menu";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  customerName: string;
  customerMeta?: string;
  items: OrderItem[];
  savedItems?: OrderItem[];
  onIncrease: (menuItemId: string) => void;
  onDecrease: (menuItemId: string) => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
}

function OrderCart({
  customerName,
  customerMeta,
  items,
  savedItems = [],
  onIncrease,
  onDecrease,
  onSave,
  saveDisabled = false,
  saveLabel = "Save Order",
}: Props) {
  const total = items.reduce(
    (sum, item) =>
      sum +
      item.price * item.quantity,
    0
  );

  return (
    <Card className="flex h-full min-h-0 flex-col p-5">
      <div className="border-b pb-4">
        <p className="text-sm text-gray-500">
          Current Order
        </p>

        <h2 className="mt-1 text-2xl font-bold">
          {customerName}
        </h2>

        {customerMeta && (
          <p className="mt-1 text-sm text-gray-500">
            {customerMeta}
          </p>
        )}
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto">
        {items.length === 0 &&
          savedItems.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-300">
                Cart
              </div>

              <p className="mt-4 text-gray-500">
                No items added yet.
              </p>
            </div>
          </div>
        )}

        {savedItems.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Saved Bill Items
            </p>

            {savedItems.map((item) => (
              <div
                key={`${item.menuItemId}-${item.orderedAt ?? item.name}`}
                className="rounded-xl border bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {item.name}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Rs. {item.price} x {item.quantity}
                    </p>
                  </div>

                  <div className="shrink-0 font-bold text-emerald-600">
                    Rs. {item.subtotal}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 &&
          savedItems.length > 0 && (
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              New Items
            </p>
          )}

        {items.map((item) => (
          <div
            key={item.menuItemId}
            className="rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {item.name}
                </h3>

                <p className="text-sm text-gray-500">
                  Rs. {item.price} each
                </p>
              </div>

              <div className="shrink-0 font-bold text-emerald-600">
                Rs.{" "}
                {item.price * item.quantity}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    onDecrease(item.menuItemId)
                  }
                  aria-label={`Decrease ${item.name}`}
                >
                  -
                </Button>

                <div className="w-8 text-center font-bold">
                  {item.quantity}
                </div>

                <Button
                  size="icon"
                  onClick={() =>
                    onIncrease(item.menuItemId)
                  }
                  aria-label={`Increase ${item.name}`}
                >
                  +
                </Button>
              </div>

              <div className="text-sm text-gray-500">
                Qty
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-5">
        <div className="mb-5 flex items-center justify-between text-xl font-bold">
          <span>Total</span>

          <span className="text-emerald-600">
            Rs. {total}
          </span>
        </div>

        <Button
          className="w-full text-lg"
          size="lg"
          onClick={onSave}
          disabled={
            saveDisabled || !items.length
          }
        >
          {saveLabel}
        </Button>
        {!items.length && (
          <p className="mt-2 text-center text-sm text-slate-500">
            No new items to save
          </p>
        )}
      </div>
    </Card>
  );
}

export default OrderCart;
