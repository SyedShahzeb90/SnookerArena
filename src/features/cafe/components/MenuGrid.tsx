import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type {
  MenuItem,
  OrderItem,
} from "../types/menu";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import MenuCard from "./MenuCard";
import OrderSummary from "./OrderSummary";

interface Props {
  menu: MenuItem[];

  customerName: string;

  cart: OrderItem[];

  onAdd: (
    item: MenuItem,
    saleOptionId?: string
  ) => void;

  onIncrease: (
    menuItemId: string
  ) => void;

  onDecrease: (
    menuItemId: string
  ) => void;

  onSave: () => void;
}

function MenuGrid({
  menu,
  customerName,
  cart,
  onAdd,
  onIncrease,
  onDecrease,
  onSave,
}: Props) {
  const [search, setSearch] =
    useState("");

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          menu.map(
            (item) => item.category
          )
        )
      ),
    [menu]
  );

  const filteredMenu = menu.filter(
    (item) =>
      item.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-8">
        <Input
          placeholder="🔍 Search menu..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

        {categories.map(
          (category) => {
            const items =
              filteredMenu.filter(
                (item) =>
                  item.category ===
                  category
              );

            if (
              items.length === 0
            )
              return null;

            return (
              <div
                key={category}
              >
                <h2 className="mb-4 text-2xl font-bold">
                  {category}
                </h2>

                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map(
                    (item) => (
                      <MenuCard
                        key={item.id}
                        item={item}
                        onAdd={(saleOptionId) =>
                          onAdd(
                            item,
                            saleOptionId
                          )
                        }
                      />
                    )
                  )}
                </div>
              </div>
            );
          }
        )}

        {filteredMenu.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-700">
              <EmptyState
                compact
                icon={Search}
                title="No Products Found"
                description="Try another search or category."
              />
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try another category or search term.
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-4">
        <OrderSummary
          customerName={
            customerName
          }
          items={cart}
          onIncrease={
            onIncrease
          }
          onDecrease={
            onDecrease
          }
        />

        <Button
          className="mt-4 h-14 w-full text-lg"
          onClick={onSave}
        >
          💾 Save Order
        </Button>
      </div>
    </div>
  );
}

export default MenuGrid;
