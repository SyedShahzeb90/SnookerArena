import { Eye, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { paymentMethodLabels } from "@/features/business-day/types/businessDay";
import type { PaymentMethod } from "@/types/session";
import { formatAppDateTime, useAppDateTimeFormats } from "@/lib/dateTime";
import {
  getOutsidePurchaseSummary,
  useOutsidePurchaseStore,
} from "../store/outsidePurchaseStore";
import type {
  OutsidePurchase,
  OutsidePurchaseStatus,
} from "../types/outsidePurchase";

type Filter = "all" | OutsidePurchaseStatus;

const statusLabels: Record<OutsidePurchaseStatus, string> = {
  pending: "Reimbursement Pending",
  partial: "Partially Reimbursed",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled / Voided",
};

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function makeId() {
  return `REIMB-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function OutsidePurchasesPanel() {
  useAppDateTimeFormats();
  const purchases = useOutsidePurchaseStore((state) => state.purchases);
  const recordReimbursement = useOutsidePurchaseStore((state) => state.recordReimbursement);
  const voidOutsidePurchase = useOutsidePurchaseStore((state) => state.voidOutsidePurchase);
  const activeDay = useBusinessDayStore((state) => state.getActiveBusinessDay());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<OutsidePurchase | null>(null);
  const [reimbursing, setReimbursing] = useState<OutsidePurchase | null>(null);
  const [voiding, setVoiding] = useState<OutsidePurchase | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const reimbursementId = useRef(makeId());
  const summary = useMemo(() => getOutsidePurchaseSummary(purchases), [purchases]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return purchases.filter((item) =>
      (filter === "all" || item.status === filter) &&
      (!query || `${item.customerName} ${item.tableName} ${item.description}`.toLowerCase().includes(query))
    );
  }, [filter, purchases, search]);

  const openReimbursement = (purchase: OutsidePurchase) => {
    setReimbursing(purchase);
    setAmount(String(purchase.outstandingAmount));
    setMethod("cash");
    setNote("");
    setError("");
    reimbursementId.current = makeId();
  };

  const submitReimbursement = () => {
    if (submitting.current || !reimbursing) return;
    if (!activeDay) {
      setError("Start a business day before recording reimbursement.");
      return;
    }
    submitting.current = true;
    const result = recordReimbursement({
      id: reimbursementId.current,
      purchaseId: reimbursing.id,
      amount: Number(amount),
      paymentMethod: method,
      operator: activeDay.openedBy,
      businessDayId: activeDay.id,
      note,
    });
    submitting.current = false;
    if (!result.ok) {
      setError(result.error ?? "Unable to record reimbursement.");
      return;
    }
    setReimbursing(null);
  };

  const submitVoid = () => {
    if (submitting.current || !voiding) return;
    if (!activeDay) {
      setError("Start a business day before returning cash to the drawer.");
      return;
    }
    submitting.current = true;
    const result = voidOutsidePurchase({
      purchaseId: voiding.id,
      reason,
      operator: activeDay.openedBy,
      businessDayId: activeDay.id,
    });
    submitting.current = false;
    if (!result.ok) {
      setError(result.error ?? "Unable to void customer outside purchase.");
      return;
    }
    setVoiding(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Paid Out", summary.paidOut],
          ["Reimbursed", summary.reimbursed],
          ["Outstanding", summary.outstanding],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{money(Number(value))}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-slate-700">Purchase Funding</span>
        <span>Cash Drawer: <strong>{money(summary.fundingByMethod.cash)}</strong></span>
        <span>Easypaisa: <strong>{money(summary.fundingByMethod.easypaisa)}</strong></span>
        <span>JazzCash: <strong>{money(summary.fundingByMethod.jazzcash)}</strong></span>
        <span>Card: <strong>{money(summary.fundingByMethod.card)}</strong></span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-slate-700">Customer Reimbursements</span>
        <span>Cash: <strong>{money(summary.byMethod.cash)}</strong></span>
        <span>Easypaisa: <strong>{money(summary.byMethod.easypaisa)}</strong></span>
        <span>JazzCash: <strong>{money(summary.byMethod.jazzcash)}</strong></span>
        <span>Card: <strong>{money(summary.byMethod.card)}</strong></span>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_220px]">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="Search customer, table, description..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="h-10 rounded-md border bg-white px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partially Reimbursed</option>
            <option value="reimbursed">Reimbursed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{["Date / Time", "Table", "Customer", "Description", "Paid Out", "Reimbursed", "Outstanding", "Status", "Actions"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t bg-white">
                  <td className="whitespace-nowrap px-3 py-3">{formatAppDateTime(item.createdAt)}</td>
                  <td className="px-3 py-3">{item.tableName}</td>
                  <td className="px-3 py-3 font-semibold">{item.customerName}</td>
                  <td className="px-3 py-3">{item.description}</td>
                  <td className="px-3 py-3 font-semibold">
                    <span className="whitespace-nowrap">{money(item.amountPaidFromDrawer)}</span>
                    <span className="block text-xs font-normal text-slate-500">
                      {item.paymentMethod
                        ? paymentMethodLabels[item.paymentMethod]
                        : "Cash Drawer"}
                    </span>
                  </td>
                  <td className="px-3 py-3">{money(item.totalReimbursed)}</td>
                  <td className="px-3 py-3 font-bold text-amber-700">{money(item.outstandingAmount)}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{statusLabels[item.status]}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelected(item)}><Eye className="h-3.5 w-3.5" /> Details</Button>
                      {(item.status === "pending" || item.status === "partial") && <Button size="sm" onClick={() => openReimbursement(item)}>Record Reimbursement</Button>}
                      {item.status === "pending" && item.totalReimbursed === 0 && <Button variant="destructive" size="sm" onClick={() => { setVoiding(item); setReason(""); setError(""); }}>Void</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No customer outside purchases found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={Boolean(reimbursing)} onOpenChange={(open) => !open && setReimbursing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Reimbursement</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-slate-500">Outstanding: {money(reimbursing?.outstandingAmount ?? 0)}</p>
            <div><Label>Amount Received</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div><Label>Payment Method</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><Label>Optional Note</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button onClick={submitReimbursement}>Record Reimbursement</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voiding)} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void Customer Outside Purchase</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">
              Confirm that {money(voiding?.amountPaidFromDrawer ?? 0)} was reversed through{" "}
              {voiding?.paymentMethod
                ? paymentMethodLabels[voiding.paymentMethod]
                : "Cash Drawer"}.
            </p>
            <div><Label>Reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button variant="destructive" onClick={submitVoid}>Confirm Void and Restore Cash</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Customer Outside Purchase</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3">
                <span>Table: <strong>{selected.tableName}</strong></span>
                <span>Customer: <strong>{selected.customerName}</strong></span>
                <span>Paid out: <strong>{money(selected.amountPaidFromDrawer)}</strong></span>
                <span>Paid using: <strong>{selected.paymentMethod ? paymentMethodLabels[selected.paymentMethod] : "Cash Drawer"}</strong></span>
                <span>Outstanding: <strong>{money(selected.outstandingAmount)}</strong></span>
              </div>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                <div><p className="font-semibold">{formatAppDateTime(selected.createdAt)}</p><p>{money(selected.amountPaidFromDrawer)} paid through {selected.paymentMethod ? paymentMethodLabels[selected.paymentMethod] : "Cash Drawer"} by {selected.operator}</p></div>
                {selected.reimbursements.map((item) => <div key={item.id}><p className="font-semibold">{formatAppDateTime(item.createdAt)}</p><p>{money(item.amount)} reimbursed through {paymentMethodLabels[item.paymentMethod]} by {item.operator}</p>{item.note && <p className="text-slate-500">{item.note}</p>}</div>)}
                {selected.cancelledAt && <div><p className="font-semibold">{formatAppDateTime(selected.cancelledAt)}</p><p>Voided by {selected.cancelledBy}: {selected.cancellationReason}</p></div>}
              </div>
              <p className="font-bold">Outstanding: {money(selected.outstandingAmount)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OutsidePurchasesPanel;
