import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useCafeStore } from "../store/cafeStore";

type SelectedTarget =
  | {
      type: "runningTable";
      tableId: number;
      sessionId: string;
      playerName: string;
    }
  | {
      type: "waitingCustomer";
      customerId: string;
    }
  | {
      type: "openBill";
      customerAccountId: string;
    }
  | null;

interface Props {
  disabled?: boolean;
  selectedTarget: SelectedTarget;
  onAddItem?: (menuItemId: string) => void;
}

const categories = [
  "All",
  "Snacks",
  "Fast Food",
  "Drinks",
  "Tea / Coffee",
  "Desserts",
  "Other",
];

function getMenuIcon(
  item: {
    emoji?: string;
    category: string;
  }
) {
  if (item.emoji?.trim()) return item.emoji;
  if (item.category === "Fast Food") return "🍔";
  if (item.category === "Snacks") return "🍟";
  if (item.category === "Drinks") return "🥤";
  if (item.category === "Tea / Coffee") return "☕";
  if (item.category === "Desserts") return "🍰";
  return "🍽";
}

function MenuPanel({
  disabled = false,
  selectedTarget,
  onAddItem,
}: Props) {
  const {
    menu,
    addItemToPlayer,
    addItemToWaitingCustomer,
  } = useCafeStore();

  const [search, setSearch] = useState("");

  const [category, setCategory] =
    useState("All");

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesSearch =
        item.name
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" ||
        item.category === category;

      return (
        (item.isAvailable ??
          item.available) &&
        matchesSearch &&
        matchesCategory
      );
    });
  }, [menu, search, category]);

  if (disabled || !selectedTarget) {
    return (
      <div className="flex h-full flex-col">
        <Input
          placeholder="Search food..."
          disabled
          className="mb-5"
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant="secondary"
              disabled
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-6xl">
              🍔
            </div>

            <h2 className="mt-4 text-2xl font-bold">
              Select a Customer
            </h2>

            <p className="mt-2 text-gray-500">
              Choose a player or waiting customer first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">

      <Input
        placeholder="Search food..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="mb-5"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={
              category === cat
                ? "default"
                : "secondary"
            }
            onClick={() =>
              setCategory(cat)
            }
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto pr-2">

        {filteredMenu.map((item) => (

          <div
            key={item.id}
            className="flex flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md"
          >

            <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-slate-100 text-5xl">

              {getMenuIcon(item)}

            </div>

            <h3 className="font-semibold">
              {item.name}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {item.category}
            </p>

            <p className="mt-4 text-lg font-bold text-emerald-600">
              Rs. {item.price}
            </p>

            <Button
              className="mt-4"
              onClick={() => {

                if (
                  onAddItem
                ) {
                  onAddItem(item.id);
                  return;
                }

                if (
                  selectedTarget.type ===
                  "runningTable"
                ) {
                  addItemToPlayer(
                    selectedTarget.tableId,
                    selectedTarget.sessionId,
                    selectedTarget.playerName,
                    item
                  );
                } else {
                  addItemToWaitingCustomer(
                    selectedTarget.type ===
                      "waitingCustomer"
                      ? selectedTarget.customerId
                      : selectedTarget.customerAccountId,
                    item
                  );
                }

              }}
            >
              + Add
            </Button>

          </div>

        ))}

      </div>

    </div>
  );
}

export default MenuPanel;

