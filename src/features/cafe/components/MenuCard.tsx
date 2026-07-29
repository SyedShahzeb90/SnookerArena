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

import { useMenuImageSource } from "../hooks/useMenuImageSource";
import type { MenuItem } from "../types/menu";

interface Props {
  item: MenuItem;
  onAdd: () => void;
}

function MenuCard({ item, onAdd }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSource = useMenuImageSource(item);
  const category = item.category.toLowerCase();
  const preservePackage = category.includes("cig");
  const tracked = item.trackStock === true;
  const stock = Math.max(0, item.currentStock ?? 0);
  const outOfStock = tracked && stock === 0;
  const lowStock =
    tracked &&
    stock > 0 &&
    stock <= Math.max(0, item.lowStockAlertQuantity ?? 0);
  const FallbackIcon =
    category.includes("tea") || category.includes("coffee")
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
  }, [imageSource]);

  return (
    <Card className="group flex min-w-0 flex-col overflow-hidden rounded-lg border-slate-200 bg-white shadow-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
      <div className="aspect-square w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
        {imageSource && !imageFailed ? (
          <img
            src={imageSource}
            alt={item.name}
            className={`h-full w-full ${
              preservePackage ? "object-contain p-2" : "object-cover"
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
          {outOfStock ? (
            <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
              Out of Stock
            </span>
          ) : lowStock ? (
            <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
              Low Stock · {stock} {item.stockUnit || "pcs"}
            </span>
          ) : tracked ? (
            <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {stock} {item.stockUnit || "pcs"} available
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          Rs. {Math.round(item.price).toLocaleString()}
        </p>

        <Button
          className="mt-3 h-9 w-full gap-1.5"
          onClick={onAdd}
          disabled={outOfStock}
        >
          <Plus className="h-4 w-4" />
          {outOfStock ? "Out of Stock" : "Add"}
        </Button>
      </div>
    </Card>
  );
}

export default MenuCard;
