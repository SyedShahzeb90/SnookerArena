import type { VendorRestockingRecord } from "@/features/cafe/store/cafeStore";
import type { MenuItem } from "@/features/cafe/types/menu";
import type { Sale } from "@/features/sales/types/sale";

export interface CanteenProfitProductRow {
  menuItemId: string;
  productName: string;
  quantitySold: number;
  unit: string;
  salesRevenue: number;
  averageUnitCost?: number;
  estimatedInventoryCost: number;
  estimatedGrossProfit: number;
  hasCostData: boolean;
}

export interface CanteenProfitReport {
  salesRevenue: number;
  estimatedInventoryCost: number;
  estimatedGrossProfit: number;
  grossMarginPercentage: number;
  quantitySold: number;
  unallocatedLegacyRevenue: number;
  quantityWithoutCost: number;
  rows: CanteenProfitProductRow[];
}

export function calculateCanteenProfitReport({
  sales,
  restockingRecords,
  menu,
}: {
  sales: Sale[];
  restockingRecords: VendorRestockingRecord[];
  menu: MenuItem[];
}): CanteenProfitReport {
  const costs = restockingRecords
    .filter((record) => record.status === "active")
    .reduce<Record<string, { quantity: number; cost: number }>>((summary, record) => {
      const current = summary[record.menuItemId] ?? { quantity: 0, cost: 0 };
      summary[record.menuItemId] = {
        quantity: current.quantity + record.quantityReceived,
        cost: current.cost + record.totalCost,
      };
      return summary;
    }, {});

  const productSales = sales.flatMap((sale) => sale.orderedItems ?? []).reduce<Record<string, { name: string; quantity: number; revenue: number }>>((summary, item) => {
    if (!item.menuItemId) return summary;
    const current = summary[item.menuItemId] ?? { name: item.name, quantity: 0, revenue: 0 };
    summary[item.menuItemId] = {
      name: item.name || current.name,
      quantity: current.quantity + item.quantity,
      revenue: current.revenue + item.subtotal,
    };
    return summary;
  }, {});

  const rows = Object.entries(productSales).map<CanteenProfitProductRow>(([menuItemId, sold]) => {
    const product = menu.find((item) => item.id === menuItemId);
    const cost = costs[menuItemId];
    const averageUnitCost = cost && cost.quantity > 0 ? cost.cost / cost.quantity : undefined;
    const estimatedInventoryCost = averageUnitCost === undefined ? 0 : averageUnitCost * sold.quantity;
    return {
      menuItemId,
      productName: product?.name ?? sold.name,
      quantitySold: sold.quantity,
      unit: product?.stockUnit || "pcs",
      salesRevenue: sold.revenue,
      averageUnitCost,
      estimatedInventoryCost,
      estimatedGrossProfit: sold.revenue - estimatedInventoryCost,
      hasCostData: averageUnitCost !== undefined,
    };
  }).sort((a, b) => b.salesRevenue - a.salesRevenue || a.productName.localeCompare(b.productName));

  const salesRevenue = sales.reduce((total, sale) => total + sale.cafeAmount, 0);
  const allocatedRevenue = rows.reduce((total, row) => total + row.salesRevenue, 0);
  const estimatedInventoryCost = rows.reduce((total, row) => total + row.estimatedInventoryCost, 0);
  const estimatedGrossProfit = salesRevenue - estimatedInventoryCost;
  const quantitySold = rows.reduce((total, row) => total + row.quantitySold, 0);

  return {
    salesRevenue,
    estimatedInventoryCost,
    estimatedGrossProfit,
    grossMarginPercentage: salesRevenue > 0 ? (estimatedGrossProfit / salesRevenue) * 100 : 0,
    quantitySold,
    unallocatedLegacyRevenue: Math.max(0, salesRevenue - allocatedRevenue),
    quantityWithoutCost: rows.filter((row) => !row.hasCostData).reduce((total, row) => total + row.quantitySold, 0),
    rows,
  };
}
