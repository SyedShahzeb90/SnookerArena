import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { useOutsidePurchaseStore } from "../store/outsidePurchaseStore";

export interface OutsidePurchaseOwner {
  customerId?: string;
  customerAccountId?: string;
  customerToken?: string;
  customerName: string;
}

interface Props {
  open: boolean;
  tableId: number;
  tableName: string;
  sessionId: string;
  owners: OutsidePurchaseOwner[];
  onOpenChange: (open: boolean) => void;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function OutsidePurchaseDialog({
  open,
  tableId,
  tableName,
  sessionId,
  owners,
  onOpenChange,
}: Props) {
  const activeDay = useBusinessDayStore((state) => state.getActiveBusinessDay());
  const createOutsidePurchase = useOutsidePurchaseStore(
    (state) => state.createOutsidePurchase
  );
  const [ownerIndex, setOwnerIndex] = useState("0");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const purchaseId = useRef(makeId("OUTSIDE"));

  const validOwners = useMemo(
    () => owners.filter((owner) => owner.customerName.trim()),
    [owners]
  );

  useEffect(() => {
    if (!open) return;
    setOwnerIndex("0");
    setDescription("");
    setAmount("");
    setPaymentMethod("cash");
    setNote("");
    setError("");
    submitting.current = false;
    purchaseId.current = makeId("OUTSIDE");
  }, [open]);

  const confirm = () => {
    if (submitting.current) return;
    const owner = validOwners[Number(ownerIndex)] ?? validOwners[0];
    const parsedAmount = Number(amount);

    if (!activeDay) {
      setError("Start the business day before recording an outside purchase.");
      return;
    }
    if (!owner) {
      setError("Select a valid customer or bill owner.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount paid must be greater than zero.");
      return;
    }

    submitting.current = true;
    const result = createOutsidePurchase({
      id: purchaseId.current,
      tableId,
      tableName,
      sessionId,
      ...owner,
      description,
      note,
      paymentMethod,
      amountPaidFromDrawer: parsedAmount,
      operator: activeDay.openedBy,
      businessDayId: activeDay.id,
    });
    submitting.current = false;

    if (!result.ok) {
      setError(result.error ?? "Unable to record customer outside purchase.");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Outside Purchase</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Table</Label>
            <Input value={tableName} readOnly />
          </div>
          <div>
            <Label>Customer / Bill Owner</Label>
            {validOwners.length > 1 ? (
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={ownerIndex}
                onChange={(event) => setOwnerIndex(event.target.value)}
              >
                {validOwners.map((owner, index) => (
                  <option key={`${owner.customerId ?? owner.customerName}-${index}`} value={index}>
                    {owner.customerName}
                  </option>
                ))}
              </select>
            ) : (
              <Input value={validOwners[0]?.customerName ?? "Walk-in Customer"} readOnly />
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Input
              placeholder="Outside food order, medicine, delivery payment..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div>
            <Label>Paid Using</Label>
            <select
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
            >
              <option value="cash">Cash Drawer</option>
              <option value="easypaisa">{paymentMethodLabels.easypaisa}</option>
              <option value="card">{paymentMethodLabels.card}</option>
              <option value="jazzcash">{paymentMethodLabels.jazzcash}</option>
            </select>
          </div>
          <div>
            <Label>Amount Paid</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <Label>Optional Note</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={confirm}>
              Confirm {paymentMethodLabels[paymentMethod]} Paid Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OutsidePurchaseDialog;
