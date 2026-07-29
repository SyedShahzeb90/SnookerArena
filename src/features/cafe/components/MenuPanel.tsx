import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { useCafeStore } from "../store/cafeStore";
import MenuCard from "./MenuCard";

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

function MenuPanel({
  disabled = false,
  selectedTarget,
  onAddItem,
}: Props) {
  const { menu, addItemToPlayer, addItemToWaitingCustomer } = useCafeStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const clearSearch = () => {
    setSearch("");
    searchInputRef.current?.focus();
  };

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(menu.map((item) => item.category)))],
    [menu]
  );

  const filteredMenu = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const getSearchRank = (item: (typeof menu)[number]) => {
      if (!query) return 0;
      const name = item.name.toLocaleLowerCase();
      const categoryName = item.category.toLocaleLowerCase();
      if (name === query) return 0;
      if (name.startsWith(query)) return 1;
      if (name.split(/\s+/).some((word) => word.startsWith(query))) return 2;
      if (name.includes(query)) return 3;
      if (categoryName.includes(query)) return 4;
      return Number.POSITIVE_INFINITY;
    };

    return menu
      .filter((item) =>
        (item.isAvailable ?? item.available) &&
        getSearchRank(item) < Number.POSITIVE_INFINITY &&
        (category === "All" || item.category === category)
      )
      .sort((a, b) => {
        const rankDifference = getSearchRank(a) - getSearchRank(b);
        return rankDifference || a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [menu, search, category]);

  const addItem = (menuItemId: string) => {
    if (onAddItem) {
      onAddItem(menuItemId);
      clearSearch();
      return;
    }

    const item = menu.find((menuItem) => menuItem.id === menuItemId);
    if (!item || !selectedTarget) return;

    if (selectedTarget.type === "runningTable") {
      addItemToPlayer(
        selectedTarget.tableId,
        selectedTarget.sessionId,
        selectedTarget.playerName,
        item
      );
    } else {
      addItemToWaitingCustomer(
        selectedTarget.type === "waitingCustomer"
          ? selectedTarget.customerId
          : selectedTarget.customerAccountId,
        item
      );
    }
    clearSearch();
  };

  const controls = (
    <div className="sticky top-0 z-10 -mt-1 bg-white pb-3 dark:bg-background">
      <Input
        ref={searchInputRef}
        autoFocus={!disabled}
        placeholder="Search menu..."
        value={search}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clearSearch();
          }
          if (event.key === "Enter" && filteredMenu[0]) {
            event.preventDefault();
            addItem(filteredMenu[0].id);
          }
        }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {categories.map((itemCategory) => (
          <Button
            key={itemCategory}
            size="sm"
            variant={category === itemCategory ? "default" : "secondary"}
            disabled={disabled}
            onClick={() => setCategory(itemCategory)}
          >
            {itemCategory}
          </Button>
        ))}
      </div>
    </div>
  );

  if (disabled || !selectedTarget) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {controls}
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <h2 className="text-xl font-bold">Select a customer</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a player, table, or open bill to begin ordering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {controls}
      <div className="grid min-h-0 flex-1 auto-rows-max content-start grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {filteredMenu.map((item) => (
          <MenuCard key={item.id} item={item} onAdd={() => addItem(item.id)} />
        ))}
        {filteredMenu.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              compact
              icon={Search}
              title="No Products Found"
              description="Try another search or category."
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MenuPanel;
