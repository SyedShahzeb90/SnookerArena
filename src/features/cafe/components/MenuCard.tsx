import {
  Cigarette,
  Coffee,
  Cookie,
  CupSoda,
  PackageOpen,
  Plus,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { MenuItem } from "../types/menu";

interface Props {
  item: MenuItem;
  onAdd: () => void;
}

function MenuCard({ item, onAdd }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const category = item.category.toLowerCase();
  const preservePackage = category.includes("cig");
  const FallbackIcon = category.includes("tea") || category.includes("coffee")
    ? Coffee
    : category.includes("drink")
      ? CupSoda
      : category.includes("snack")
        ? Cookie
        : category.includes("cig")
          ? Cigarette
          : category.includes("food")
            ? Utensils
            : PackageOpen;

  useEffect(() => {
    setImageFailed(false);
  }, [item.imageDataUrl]);

  return (
    <Card className="group flex min-w-0 flex-col overflow-hidden rounded-lg border-slate-200 bg-white shadow-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
      <div className="aspect-square w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
        {item.imageDataUrl && !imageFailed ? (
          <img
            src={item.imageDataUrl}
            alt={item.name}
            className={`h-full w-full ${
              preservePackage
                ? "object-contain p-2"
                : "object-cover"
            }`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <FallbackIcon className="h-7 w-7" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              {item.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-950 dark:text-slate-100">
            {item.name}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {item.category}
          </p>
        </div>

        <p className="mt-3 text-lg font-bold tabular-nums text-emerald-700">
          Rs. {Math.round(item.price).toLocaleString()}
        </p>

        <Button className="mt-3 h-9 w-full gap-1.5" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </Card>
  );
}

export default MenuCard;
