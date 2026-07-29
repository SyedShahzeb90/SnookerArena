import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { OrderItem } from "../types/menu";

interface Props {
  customerName: string;
  customerMeta?: string;
  items: OrderItem[];
  savedItems?: OrderItem[];
  onIncrease: (menuItemId: string) => void;
  onDecrease: (menuItemId: string) => void;
  onRemove?: (menuItemId: string) => void;
  onSave: () => void;
  onSaveAndReturn?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  saveAndReturnLabel?: string;
}

function OrderCart({
  customerName,
  customerMeta,
  items,
  savedItems = [],
  onIncrease,
  onDecrease,
  onRemove,
  onSave,
  onSaveAndReturn,
  saveDisabled = false,
  saveLabel = "Save Order",
  saveAndReturnLabel = "Save & Return",
}: Props) {
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const previousQuantities = useRef(
    new Map(items.map((item) => [item.menuItemId, item.quantity]))
  );
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  useEffect(() => {
    const previous = previousQuantities.current;
    const changedItem = [...items]
      .reverse()
      .find((item) => previous.get(item.menuItemId) !== item.quantity);
    previousQuantities.current = new Map(
      items.map((item) => [item.menuItemId, item.quantity])
    );
    if (!changedItem) return;
    const frame = requestAnimationFrame(() => {
      itemRefs.current.get(changedItem.menuItemId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [items]);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 rounded-xl border bg-white p-0 shadow-sm dark:bg-slate-950">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Current Order
        </p>
        <h2 className="mt-0.5 text-lg font-bold">{customerName}</h2>
        {customerMeta && <p className="text-xs text-slate-500">{customerMeta}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && savedItems.length === 0 && (
          <div className="flex min-h-32 items-center justify-center px-4 text-center">
            <div>
              <p className="font-semibold">Select a customer</p>
              <p className="mt-1 text-sm text-slate-500">to begin ordering.</p>
            </div>
          </div>
        )}

        {savedItems.length > 0 && (
          <div className="border-b px-4 py-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Saved items
            </p>
            {savedItems.map((item) => (
              <div
                key={`${item.menuItemId}-${item.orderedAt ?? item.name}`}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{item.name} x{item.quantity}</span>
                <span className="shrink-0 font-semibold tabular-nums">Rs. {item.subtotal}</span>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && savedItems.length > 0 && (
          <p className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            New items
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.menuItemId}
            ref={(element) => {
              if (element) itemRefs.current.set(item.menuItemId, element);
              else itemRefs.current.delete(item.menuItemId);
            }}
            className="flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-slate-500">Rs. {item.price} each</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon-xs" variant="outline" onClick={() => onDecrease(item.menuItemId)} aria-label={`Decrease ${item.name}`}>
                <Minus />
              </Button>
              <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
              <Button size="icon-xs" onClick={() => onIncrease(item.menuItemId)} aria-label={`Increase ${item.name}`}>
                <Plus />
              </Button>
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              Rs. {item.price * item.quantity}
            </span>
            {onRemove && (
              <Button size="icon-xs" variant="ghost" className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onRemove(item.menuItemId)} aria-label={`Remove ${item.name}`}>
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 border-t bg-white px-4 py-3 dark:bg-slate-950">
        <div className="mb-3 flex items-center justify-between text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">Rs. {total}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button className="w-full" variant="outline" onClick={onSave} disabled={saveDisabled || !items.length}>
            {saveLabel}
          </Button>
          <Button className="w-full" onClick={onSaveAndReturn ?? onSave} disabled={saveDisabled || !items.length}>
            {saveAndReturnLabel}
          </Button>
        </div>
        {!items.length && <p className="mt-2 text-center text-xs text-slate-500">No new items to save</p>}
      </div>
    </Card>
  );
}

export default OrderCart;
