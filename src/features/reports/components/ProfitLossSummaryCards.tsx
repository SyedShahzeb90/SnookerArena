import {
  Banknote,
  Coffee,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import type { ProfitLossTotals } from "../utils/calculateProfitLoss";

interface Props {
  totals: ProfitLossTotals;
}

function formatAmount(value: number) {
  return `Rs. ${Math.abs(value).toLocaleString()}`;
}

function ProfitLossSummaryCards({
  totals,
}: Props) {
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
            className={`rounded-lg p-4 shadow-sm ${
              card.highlight
                ? isLoss
                  ? "border-red-200 bg-red-50/40"
                  : "border-emerald-200 bg-emerald-50/40"
                : "bg-white"
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
    </section>
  );
}

export default ProfitLossSummaryCards;
