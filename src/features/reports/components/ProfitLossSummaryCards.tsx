import {
  Banknote,
  Coffee,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfitLossTotals } from "../utils/calculateProfitLoss";

interface Props {
  totals: ProfitLossTotals;
  cafeBreakdown?: CafeSalesBreakdown;
}

export interface CafeSalesBreakdownRow {
  item: string;
  quantity: number;
  sales: number;
}

export interface CafeSalesBreakdown {
  rows: CafeSalesBreakdownRow[];
  totalRevenue: number;
  totalItemsSold: number;
}

function formatAmount(value: number) {
  return `Rs. ${Math.abs(value).toLocaleString()}`;
}

function ProfitLossSummaryCards({
  totals,
  cafeBreakdown,
}: Props) {
  const [cafeOpen, setCafeOpen] = useState(false);
  const isLoss = totals.netProfit < 0;
  const cards = [
    {
      label: "Total Revenue",
      value: formatAmount(totals.totalRevenue),
      icon: TrendingUp,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Table Sales",
      value: formatAmount(totals.tableRevenue),
      icon: Banknote,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      label: "Cafe Sales",
      value: formatAmount(totals.cafeRevenue),
      icon: Coffee,
      tone: "text-amber-700",
      bg: "bg-amber-50",
      clickable: true,
    },
    {
      label: "Total Expenses",
      value: formatAmount(totals.totalExpenses),
      icon: WalletCards,
      tone: "text-red-700",
      bg: "bg-red-50",
    },
    {
      label: isLoss ? "Loss" : "Net Profit",
      value: formatAmount(totals.netProfit),
      helper: `${totals.profitMargin.toLocaleString()}% margin`,
      icon: isLoss ? TrendingDown : ReceiptText,
      tone: isLoss ? "text-red-700" : "text-emerald-700",
      bg: isLoss ? "bg-red-50" : "bg-emerald-50",
      highlight: true,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.label}
            role={card.clickable ? "button" : undefined}
            tabIndex={card.clickable ? 0 : undefined}
            onClick={() => {
              if (card.clickable) setCafeOpen(true);
            }}
            onKeyDown={(event) => {
              if (
                card.clickable &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                setCafeOpen(true);
              }
            }}
            className={`rounded-lg p-4 shadow-sm ${
              card.highlight
                ? isLoss
                  ? "border-red-200 bg-red-50/40"
                  : "border-emerald-200 bg-emerald-50/40"
                : "bg-white"
            } ${
              card.clickable
                ? "cursor-pointer transition hover:border-amber-200 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                : ""
            }`}
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg} ${card.tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              {card.label}
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                card.highlight ? card.tone : "text-slate-950"
              }`}
            >
              {card.value}
            </p>
            {"helper" in card && card.helper ? (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {card.helper}
              </p>
            ) : null}
          </Card>
        );
      })}
      <Dialog open={cafeOpen} onOpenChange={setCafeOpen}>
        <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cafe Sales</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Total Revenue
                </p>
                <p className="font-bold text-slate-950">
                  {formatAmount(cafeBreakdown?.totalRevenue ?? totals.cafeRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Total Items Sold
                </p>
                <p className="font-bold text-slate-950">
                  {(cafeBreakdown?.totalItemsSold ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="max-h-[52vh] overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty Sold</th>
                    <th className="px-3 py-2 text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(cafeBreakdown?.rows ?? []).map((row) => (
                    <tr key={row.item} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {row.item}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.quantity.toLocaleString()}x
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatAmount(row.sales)}
                      </td>
                    </tr>
                  ))}
                  {(cafeBreakdown?.rows.length ?? 0) === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No cafe items found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t bg-slate-50 font-bold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">
                      {(cafeBreakdown?.totalItemsSold ?? 0).toLocaleString()}x
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatAmount(cafeBreakdown?.totalRevenue ?? totals.cafeRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ProfitLossSummaryCards;
