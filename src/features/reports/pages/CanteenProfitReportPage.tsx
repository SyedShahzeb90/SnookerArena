import { ArrowLeft, BarChart3, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { calculateCanteenProfitReport } from "../utils/canteenProfitReport";

type Range = "today" | "yesterday" | "this-week" | "this-month" | "all" | "custom";

function rangeBounds(range: Range, customStart: string, customEnd: string) {
  if (range === "all") return undefined;
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === "this-week") {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === "this-month") {
    start.setDate(1);
  } else if (range === "custom") {
    if (customStart) {
      const value = new Date(`${customStart}T00:00:00`);
      if (!Number.isNaN(value.getTime())) start.setTime(value.getTime());
    } else {
      start.setTime(0);
    }
    if (customEnd) {
      const value = new Date(`${customEnd}T23:59:59.999`);
      if (!Number.isNaN(value.getTime())) end.setTime(value.getTime());
    }
  }
  return { start, end };
}

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function CanteenProfitReportPage() {
  const navigate = useNavigate();
  const sales = useSalesStore((state) => state.sales);
  const menu = useCafeStore((state) => state.menu);
  const restockingRecords = useCafeStore((state) => state.vendorRestockingRecords);
  const [range, setRange] = useState<Range>("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");

  const filteredSales = useMemo(() => {
    const bounds = rangeBounds(range, customStart, customEnd);
    if (!bounds) return sales;
    return sales.filter((sale) => {
      const value = new Date(sale.paidAt ?? sale.createdAt).getTime();
      return Number.isFinite(value) && value >= bounds.start.getTime() && value <= bounds.end.getTime();
    });
  }, [sales, range, customStart, customEnd]);

  const report = useMemo(() => calculateCanteenProfitReport({
    sales: filteredSales,
    restockingRecords,
    menu,
  }), [filteredSales, restockingRecords, menu]);

  const rows = report.rows.filter((row) => row.productName.toLowerCase().includes(search.trim().toLowerCase()));

  const cards = [
    ["Cafe Sales Revenue", money(report.salesRevenue)],
    ["Estimated Inventory Cost", money(report.estimatedInventoryCost)],
    ["Estimated Gross Profit", money(report.estimatedGrossProfit)],
    ["Gross Margin Percentage", `${report.grossMarginPercentage.toFixed(1)}%`],
    ["Quantity Sold", report.quantitySold.toLocaleString()],
  ];

  return (
    <PageShell>
      <div className="space-y-5">
        <header>
          <Button variant="ghost" className="mb-3 gap-2" onClick={() => navigate("/admin")}><ArrowLeft className="h-4 w-4" /> Admin</Button>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white"><BarChart3 className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold text-slate-950">Cafe Sales Report</h1><p className="text-sm text-slate-500">Estimate cafe gross profit from sales and vendor restocking costs.</p></div></div>
        </header>

        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs font-semibold uppercase text-slate-500">Period</label><select className="mt-1 h-10 rounded-md border bg-white px-3 text-sm" value={range} onChange={(event) => setRange(event.target.value as Range)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this-week">This Week</option><option value="this-month">This Month</option><option value="all">All Time</option><option value="custom">Custom</option></select></div>
            {range === "custom" && <><div><label className="text-xs font-semibold uppercase text-slate-500">From</label><Input className="mt-1" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></div><div><label className="text-xs font-semibold uppercase text-slate-500">To</label><Input className="mt-1" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div></>}
          </div>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value]) => <Card key={label} className="p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></Card>)}</section>

        {(report.unallocatedLegacyRevenue > 0 || report.quantityWithoutCost > 0) && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{report.unallocatedLegacyRevenue > 0 && <p>{money(report.unallocatedLegacyRevenue)} of legacy Cafe revenue has no product-level line allocation.</p>}{report.quantityWithoutCost > 0 && <p>{report.quantityWithoutCost} sold items have no vendor cost history, so their estimated cost is currently Rs. 0.</p>}</div>}

        <Card className="overflow-hidden">
          <div className="relative border-b p-4"><Search className="absolute left-7 top-7 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search Cafe product..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Product", "Quantity Sold", "Cafe Revenue", "Average Unit Cost", "Estimated Cost", "Estimated Gross Profit"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.menuItemId} className="border-t bg-white"><td className="px-4 py-3 font-semibold">{row.productName}</td><td className="px-4 py-3">{row.quantitySold} {row.unit}</td><td className="px-4 py-3 font-semibold">{money(row.salesRevenue)}</td><td className="px-4 py-3">{row.averageUnitCost === undefined ? "No cost data" : money(row.averageUnitCost)}</td><td className="px-4 py-3">{money(row.estimatedInventoryCost)}</td><td className={`px-4 py-3 font-bold ${row.estimatedGrossProfit < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(row.estimatedGrossProfit)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No Cafe sales found for this period.</td></tr>}</tbody></table></div>
        </Card>
      </div>
    </PageShell>
  );
}

export default CanteenProfitReportPage;
