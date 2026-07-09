import { useMemo, useState } from "react";

import type {
  MenuItem,
  OrderItem,
} from "../types/menu";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import MenuCard from "./MenuCard";
import OrderSummary from "./OrderSummary";

interface Props {
  menu: MenuItem[];

  customerName: string;

  cart: OrderItem[];

  onAdd: (
    item: MenuItem
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
    () => [
      "Fast Food",
      "Snacks",
      "Drinks",
      "Desserts",
    ],
    []
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
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 space-y-6">
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

                <div className="grid grid-cols-3 gap-4">
                  {items.map(
                    (item) => (
                      <MenuCard
                        key={item.id}
                        item={item}
                        onAdd={() =>
                          onAdd(
                            item
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
      </div>

      <div className="col-span-4">
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
