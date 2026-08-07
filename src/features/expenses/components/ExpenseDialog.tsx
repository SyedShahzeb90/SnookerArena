import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentMethod } from "@/types/session";
import {
  getPaymentMethodOptions,
  useClubSettingsStore,
} from "@/features/settings/store/clubSettingsStore";

import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../types/expense";
import { expenseCategories } from "../types/expense";

interface Props {
  open: boolean;
  expense?: Expense | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ExpenseInput) => void;
}

function toDateTimeInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(
    date.getTime() - offset * 60000
  );

  return local.toISOString().slice(0, 16);
}

function ExpenseDialog({
  open,
  expense,
  onOpenChange,
  onSave,
}: Props) {
  const clubSettings = useClubSettingsStore((state) => state.settings);
  const paymentMethodOptions = getPaymentMethodOptions(clubSettings);
  const [category, setCategory] =
    useState<ExpenseCategory | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] =
    useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (!open) return;

    setCategory(expense?.category ?? "");
    setAmount(
      expense ? String(expense.amount) : ""
    );
    setNote(expense?.note ?? "");
    setExpenseDate(
      expense
        ? toDateTimeInputValue(
            expense.expenseDate
          )
        : toDateTimeInputValue(
            new Date().toISOString()
          )
    );
    setPaymentMethod(
      expense?.paymentMethod ?? "cash"
    );
    setMessage("");
  }, [open, expense]);

  const handleSave = () => {
    const parsedAmount = Number(amount);

    if (!category) {
      setMessage("Please choose a category.");
      return;
    }

    if (!amount.trim()) {
      setMessage("Please enter an amount.");
      return;
    }

    if (
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setMessage(
        "Amount must be greater than 0."
      );
      return;
    }

    if (!expenseDate) {
      setMessage(
        "Please choose the date and time."
      );
      return;
    }

    onSave({
      category,
      amount: parsedAmount,
      note: note.trim(),
      expenseDate:
        new Date(expenseDate).toISOString(),
      paymentMethod,
    });

    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {expense
              ? "Edit Expense"
              : "Add Expense"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(
                  value as ExpenseCategory
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map(
                  (item) => (
                    <SelectItem
                      key={item}
                      value={item}
                    >
                      {item}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min="1"
              placeholder="Example: 500"
              value={amount}
              onChange={(event) =>
                setAmount(
                  event.target.value
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              placeholder="Example: Electricity bill"
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) =>
                setPaymentMethod(
                  value as PaymentMethod
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date and Time</Label>
            <Input
              type="datetime-local"
              value={expenseDate}
              onChange={(event) =>
                setExpenseDate(
                  event.target.value
                )
              }
            />
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() =>
                onOpenChange(false)
              }
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Expense
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExpenseDialog;
