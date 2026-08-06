import { ArrowLeft, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { formatAppDate, useAppDateTimeFormats } from "@/lib/dateTime";
import { getOperatorDisplayName } from "@/lib/operatorAttribution";
import {
  useCafeStore,
  type VendorRestockingPaymentSource,
} from "../store/cafeStore";

const paymentSourceLabels: Record<VendorRestockingPaymentSource, string> = {
  cash_drawer: "Cash Drawer",
  digital: "Digital",
  staff_paid: "Staff Paid",
  owner_paid: "Owner Paid",
  vendor_credit: "Unpaid / Vendor Credit",
};

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function VendorRestockingPage() {
  useAppDateTimeFormats();
  const navigate = useNavigate();
  const menu = useCafeStore((state) => state.menu);
  const records = useCafeStore((state) => state.vendorRestockingRecords);
  const recordRestocking = useCafeStore((state) => state.recordVendorRestocking);
  const cancelRestocking = useCafeStore((state) => state.cancelVendorRestocking);
  const payVendorCredit = useCafeStore((state) => state.payVendorCredit);
  const activeDay = useBusinessDayStore((state) => state.getActiveBusinessDay());
  const trackedProducts = useMemo(() => menu.filter((item) => item.trackStock === true).sort((a, b) => a.name.localeCompare(b.name)), [menu]);

  const [vendorName, setVendorName] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [paymentSource, setPaymentSource] = useState<VendorRestockingPaymentSource>("cash_drawer");
  const [purchaseDate, setPurchaseDate] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const selectedProduct = trackedProducts.find((item) => item.id === menuItemId);
  const parsedQuantity = Number(quantity);
  const parsedCost = Number(costPerUnit);
  const totalCost = Number.isFinite(parsedQuantity) && Number.isFinite(parsedCost) && parsedQuantity > 0 && parsedCost >= 0
    ? parsedQuantity * parsedCost
    : 0;

  const vendors = useMemo(() => Array.from(new Set(records.map((record) => record.vendorName))).sort(), [records]);
  const filteredRecords = useMemo(() => records.filter((record) => {
    const haystack = `${record.vendorName} ${record.productName} ${record.note ?? ""} ${getOperatorDisplayName(record.createdByOperator, record.createdBy)}`.toLowerCase();
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (vendorFilter && record.vendorName !== vendorFilter) return false;
    if (productFilter !== "all" && record.menuItemId !== productFilter) return false;
    if (paymentFilter !== "all" && record.paymentSource !== paymentFilter) return false;
    if (dateFrom && record.purchaseDate < dateFrom) return false;
    if (dateTo && record.purchaseDate > dateTo) return false;
    return true;
  }), [records, search, vendorFilter, productFilter, paymentFilter, dateFrom, dateTo]);

  const save = () => {
    setError("");
    setMessage("");
    if (!quantity.trim() || !costPerUnit.trim()) {
      setError("Quantity and cost per unit are required.");
      return;
    }
    try {
      const record = recordRestocking({
        vendorName,
        menuItemId,
        quantityReceived: parsedQuantity,
        unit: selectedProduct?.stockUnit ?? "",
        costPerUnit: parsedCost,
        paymentSource,
        purchaseDate,
        note,
        createdBy: activeDay?.openedBy ?? "Operator",
        businessDayId: activeDay?.id,
      });
      setVendorName("");
      setMenuItemId("");
      setQuantity("");
      setCostPerUnit("");
      setNote("");
      setMessage(`${record.quantityReceived} ${record.unit} added to ${record.productName}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restocking could not be saved.");
    }
  };

  const cancel = (recordId: string) => {
    const cancellationNote = window.prompt("Reason for cancelling this restocking record:")?.trim();
    if (!cancellationNote) return;
    if (!window.confirm("Cancel this restocking record and reverse its stock and linked cash impact?")) return;
    try {
      cancelRestocking(recordId, {
        cancelledBy: activeDay?.openedBy ?? "Operator",
        cancellationNote,
        businessDayId: activeDay?.id,
      });
      setMessage("Restocking record cancelled and stock reversed.");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restocking could not be cancelled.");
    }
  };

  const recordCreditPayment = (recordId: string) => {
    const entered = window.prompt("Payment source: cash drawer, digital, staff paid, or owner paid")?.trim().toLowerCase();
    if (!entered) return;
    const sources: Record<string, Exclude<VendorRestockingPaymentSource, "vendor_credit">> = {
      "cash drawer": "cash_drawer",
      cash: "cash_drawer",
      digital: "digital",
      "staff paid": "staff_paid",
      staff: "staff_paid",
      "owner paid": "owner_paid",
      owner: "owner_paid",
    };
    const source = sources[entered];
    if (!source) {
      setError("Enter cash drawer, digital, staff paid, or owner paid.");
      return;
    }
    try {
      payVendorCredit(recordId, { paymentSource: source, paidBy: activeDay?.openedBy ?? "Operator", businessDayId: activeDay?.id });
      setMessage("Vendor credit payment recorded.");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be recorded.");
    }
  };

  return (
    <PageShell>
      <div className="space-y-5">
        <header>
          <Button variant="ghost" className="mb-3 gap-2" onClick={() => navigate("/admin")}><ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard</Button>
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white"><PackagePlus className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold text-slate-950">Vendor Restocking</h1><p className="text-sm text-slate-500">Record Cafe inventory received from vendors.</p></div></div>
        </header>

        {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div><label className="text-sm font-medium">Vendor Name</label><Input className="mt-1" value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></div>
            <div><label className="text-sm font-medium">Product</label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={menuItemId} onChange={(event) => setMenuItemId(event.target.value)}><option value="">Select tracked product</option>{trackedProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{selectedProduct && <p className="mt-1 text-xs text-slate-500">Current: {Math.max(0, selectedProduct.currentStock ?? 0)} {selectedProduct.stockUnit || "pcs"}</p>}</div>
            <div><label className="text-sm font-medium">Quantity Received</label><Input className="mt-1" type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
            <div><label className="text-sm font-medium">Unit</label><Input className="mt-1" value={selectedProduct?.stockUnit ?? ""} disabled /></div>
            <div><label className="text-sm font-medium">Cost Per Unit</label><Input className="mt-1" type="number" min={0} step="0.01" value={costPerUnit} onChange={(event) => setCostPerUnit(event.target.value)} /></div>
            <div><label className="text-sm font-medium">Total Cost</label><Input className="mt-1 font-semibold" value={`Rs. ${totalCost.toLocaleString()}`} disabled /></div>
            <div><label className="text-sm font-medium">Payment Source</label><select className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={paymentSource} onChange={(event) => setPaymentSource(event.target.value as VendorRestockingPaymentSource)}>{Object.entries(paymentSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label className="text-sm font-medium">Purchase Date</label><Input className="mt-1" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></div>
            <div className="md:col-span-2 lg:col-span-3"><label className="text-sm font-medium">Optional Note</label><Input className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={save}>Save Restocking</Button></div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid gap-2 border-b p-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search vendor, product, note..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <select className="h-10 rounded-md border bg-white px-3 text-sm" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option value="">All Vendors</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select>
            <select className="h-10 rounded-md border bg-white px-3 text-sm" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="all">All Products</option>{menu.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select className="h-10 rounded-md border bg-white px-3 text-sm" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">All Payment Sources</option>{Object.entries(paymentSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Date", "Vendor", "Product", "Quantity", "Cost / Unit", "Total", "Payment Source", "Note", "Created By", "Status", "Action"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className="border-t bg-white"><td className="whitespace-nowrap px-3 py-3">{formatAppDate(record.purchaseDate)}</td><td className="px-3 py-3 font-semibold">{record.vendorName}</td><td className="px-3 py-3">{record.productName}</td><td className="whitespace-nowrap px-3 py-3">{record.quantityReceived} {record.unit}</td><td className="px-3 py-3">Rs. {record.costPerUnit.toLocaleString()}</td><td className="px-3 py-3 font-bold">Rs. {record.totalCost.toLocaleString()}</td><td className="whitespace-nowrap px-3 py-3">{record.creditPaymentSource ? `${paymentSourceLabels.vendor_credit} · Paid ${paymentSourceLabels[record.creditPaymentSource]}` : paymentSourceLabels[record.paymentSource]}</td><td className="px-3 py-3">{record.note || "-"}</td><td className="px-3 py-3">{getOperatorDisplayName(record.createdByOperator, record.createdBy)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${record.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{record.status === "active" ? "Active" : "Cancelled"}</span></td><td className="px-3 py-3"><div className="flex gap-2">{record.status === "active" && record.paymentSource === "vendor_credit" && !record.creditPaidAt && <Button size="sm" variant="outline" onClick={() => recordCreditPayment(record.id)}>Record Payment</Button>}{record.status === "active" && <Button size="sm" variant="destructive" onClick={() => cancel(record.id)}>Cancel</Button>}</div></td></tr>)}{filteredRecords.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">No vendor restocking records found.</td></tr>}</tbody></table></div>
        </Card>
      </div>
    </PageShell>
  );
}

export default VendorRestockingPage;
