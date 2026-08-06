import {
  BadgeDollarSign,
  Plus,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";

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
import { useToast } from "@/components/ui/toast";
import { PageHeading, PageShell } from "@/components/layout/page-layout";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { paymentMethodLabels } from "@/features/business-day/types/businessDay";
import type { PaymentMethod } from "@/types/session";

import { useStaffPayrollStore } from "../store/staffPayrollStore";
import type {
  PayrollEmployee,
  PayrollEmployeeInput,
  PayrollEmployeeStatus,
} from "../types/payroll";

const paymentMethods: PaymentMethod[] = [
  "cash",
  "card",
  "jazzcash",
  "easypaisa",
];

type EmployeeDialogMode = "new" | "edit";
type DetailTab = "overview" | "advances" | "salary-history";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentSalaryMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getNextSalaryDate(dueDay: number) {
  const now = new Date();
  const safeDueDay = Math.min(31, Math.max(1, dueDay || 1));
  const next = new Date(now.getFullYear(), now.getMonth(), safeDueDay);
  if (next < startOfToday()) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isThisMonth(value: string) {
  return value.slice(0, 7) === currentSalaryMonth();
}

const emptyEmployeeForm: PayrollEmployeeInput = {
  name: "",
  phone: "",
  role: "",
  joiningDate: todayInputValue(),
  monthlySalary: 0,
  salaryDueDay: 1,
  status: "active",
};

function StaffPayrollPage() {
  const toast = useToast();
  const activeDay = useBusinessDayStore((state) =>
    state.getActiveBusinessDay()
  );
  const employees = useStaffPayrollStore((state) => state.employees);
  const salaryAdvances = useStaffPayrollStore((state) => state.salaryAdvances);
  const salaryPayments = useStaffPayrollStore((state) => state.salaryPayments);
  const addEmployee = useStaffPayrollStore((state) => state.addEmployee);
  const updateEmployee = useStaffPayrollStore((state) => state.updateEmployee);
  const recordSalaryAdvance = useStaffPayrollStore(
    (state) => state.recordSalaryAdvance
  );
  const recordSalaryPayment = useStaffPayrollStore(
    (state) => state.recordSalaryPayment
  );

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeDialogMode, setEmployeeDialogMode] =
    useState<EmployeeDialogMode>("new");
  const [employeeForm, setEmployeeForm] =
    useState<PayrollEmployeeInput>(emptyEmployeeForm);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayInputValue());
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>("cash");
  const [advanceNote, setAdvanceNote] = useState("");
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth());
  const [paidDate, setPaidDate] = useState(todayInputValue());
  const [bonus, setBonus] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");
  const [advanceDeduction, setAdvanceDeduction] = useState("0");
  const [salaryMethod, setSalaryMethod] = useState<PaymentMethod>("cash");

  const selectedEmployee = employees.find(
    (employee) => employee.id === selectedEmployeeId
  );
  const employeeRows = employees.map((employee) => ({
    employee,
    advanceBalance: getAdvanceBalance(employee.id, salaryAdvances, salaryPayments),
    nextSalaryDate: getNextSalaryDate(employee.salaryDueDay),
  }));
  const selectedAdvances = salaryAdvances.filter(
    (advance) => advance.employeeId === selectedEmployeeId
  );
  const selectedPayments = salaryPayments.filter(
    (payment) => payment.employeeId === selectedEmployeeId
  );
  const outstandingAdvances = selectedEmployee
    ? getAdvanceBalance(selectedEmployee.id, salaryAdvances, salaryPayments)
    : 0;
  const baseSalary = selectedEmployee?.monthlySalary ?? 0;
  const netSalary = Math.max(
    0,
    baseSalary +
      Number(bonus || 0) -
      Number(advanceDeduction || 0) -
      Number(otherDeductions || 0)
  );
  const lastSalaryPaid = selectedPayments[0];

  const summary = useMemo(() => {
    const activeEmployees = employees.filter(
      (employee) => employee.status === "active"
    );
    const salaryDueThisMonth = activeEmployees.reduce(
      (total, employee) => total + employee.monthlySalary,
      0
    );
    const outstandingAdvanceTotal = employees.reduce(
      (total, employee) =>
        total + getAdvanceBalance(employee.id, salaryAdvances, salaryPayments),
      0
    );
    const salariesPaidThisMonth = salaryPayments
      .filter((payment) => isThisMonth(payment.paidDate))
      .reduce((total, payment) => total + payment.netSalary, 0);

    return {
      activeEmployees: activeEmployees.length,
      salaryDueThisMonth,
      outstandingAdvanceTotal,
      salariesPaidThisMonth,
    };
  }, [employees, salaryAdvances, salaryPayments]);

  function openNewEmployeeDialog() {
    setEmployeeDialogMode("new");
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeDialogOpen(true);
  }

  function openEditEmployeeDialog(employee: PayrollEmployee) {
    setEmployeeDialogMode("edit");
    setEmployeeForm({
      name: employee.name,
      phone: employee.phone,
      role: employee.role,
      joiningDate: employee.joiningDate,
      monthlySalary: employee.monthlySalary,
      salaryDueDay: employee.salaryDueDay,
      status: employee.status,
    });
    setEmployeeDialogOpen(true);
  }

  function saveEmployee() {
    const name = employeeForm.name.trim();
    if (!name) {
      toast.error("Employee name is required.");
      return;
    }

    const input: PayrollEmployeeInput = {
      ...employeeForm,
      name,
      phone: employeeForm.phone.trim(),
      role: employeeForm.role.trim(),
      monthlySalary: Math.max(0, Number(employeeForm.monthlySalary || 0)),
      salaryDueDay: Math.min(
        31,
        Math.max(1, Number(employeeForm.salaryDueDay || 1))
      ),
    };

    if (employeeDialogMode === "edit" && selectedEmployee) {
      updateEmployee(selectedEmployee.id, input);
      toast.success("Employee updated.");
    } else {
      const employee = addEmployee(input);
      setSelectedEmployeeId(employee.id);
      setActiveTab("overview");
      toast.success("Employee added.");
    }

    setEmployeeDialogOpen(false);
  }

  function disableEmployee() {
    if (!selectedEmployee) return;
    updateEmployee(selectedEmployee.id, {
      ...selectedEmployee,
      status: "inactive",
    });
    toast.success("Employee disabled.");
  }

  function openAdvanceDialog() {
    setAdvanceAmount("");
    setAdvanceDate(todayInputValue());
    setAdvanceMethod("cash");
    setAdvanceNote("");
    setAdvanceDialogOpen(true);
  }

  function addAdvance() {
    if (!selectedEmployee) return;
    const amount = Number(advanceAmount || 0);
    if (amount <= 0) {
      toast.error("Advance amount must be greater than zero.");
      return;
    }

    recordSalaryAdvance({
      employeeId: selectedEmployee.id,
      amount,
      advanceDate: new Date(advanceDate).toISOString(),
      note: advanceNote.trim() || undefined,
      paymentMethod: advanceMethod,
      activeBusinessDayId: activeDay?.id,
    });
    setAdvanceDialogOpen(false);
    setActiveTab("advances");
    toast.success("Salary advance recorded.");
  }

  function openSalaryDialog() {
    setSalaryMonth(currentSalaryMonth());
    setPaidDate(todayInputValue());
    setBonus("0");
    setOtherDeductions("0");
    setAdvanceDeduction(String(outstandingAdvances));
    setSalaryMethod("cash");
    setSalaryDialogOpen(true);
  }

  function paySalary() {
    if (!selectedEmployee) return;
    if (netSalary <= 0) {
      toast.error("Net salary must be greater than zero.");
      return;
    }

    recordSalaryPayment({
      employeeId: selectedEmployee.id,
      salaryMonth,
      baseSalary,
      advancesDeducted: Math.max(0, Number(advanceDeduction || 0)),
      bonus: Math.max(0, Number(bonus || 0)),
      otherDeductions: Math.max(0, Number(otherDeductions || 0)),
      netSalary,
      paymentMethod: salaryMethod,
      paidDate: new Date(paidDate).toISOString(),
      activeBusinessDayId: activeDay?.id,
    });
    setSalaryDialogOpen(false);
    setActiveTab("salary-history");
    toast.success("Salary payment recorded.");
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          icon={BadgeDollarSign}
          title="Staff Payroll"
          description="Manage employees, advances, salary payments, and history."
        />
        <Button onClick={openNewEmployeeDialog}>
          <Plus className="h-4 w-4" />
          New Employee
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active Employees" value={String(summary.activeEmployees)} />
        <SummaryCard label="Salary Due This Month" value={money(summary.salaryDueThisMonth)} />
        <SummaryCard label="Outstanding Advances" value={money(summary.outstandingAdvanceTotal)} />
        <SummaryCard label="Salaries Paid This Month" value={money(summary.salariesPaidThisMonth)} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-bold text-slate-950">Employees</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-right">Monthly Salary</th>
                <th className="px-4 py-3 text-right">Advance Balance</th>
                <th className="px-4 py-3 text-left">Next Salary Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeRows.map(({ employee, advanceBalance, nextSalaryDate }) => (
                <tr
                  key={employee.id}
                  className={selectedEmployeeId === employee.id ? "bg-amber-50/60" : "bg-white"}
                >
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    {employee.name}
                    <p className="text-xs font-normal text-slate-500">{employee.phone || "-"}</p>
                  </td>
                  <td className="px-4 py-3">{employee.role || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(employee.monthlySalary)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(advanceBalance)}
                  </td>
                  <td className="px-4 py-3">{formatDate(nextSalaryDate.toISOString())}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={employee.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedEmployeeId(employee.id);
                        setActiveTab("overview");
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No employees added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedEmployee && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">
                  {selectedEmployee.name}
                </h2>
                <StatusBadge status={selectedEmployee.status} />
              </div>
              <p className="text-sm text-slate-500">
                {selectedEmployee.role || "-"} - Monthly salary {money(selectedEmployee.monthlySalary)} - Next salary {formatDate(getNextSalaryDate(selectedEmployee.salaryDueDay).toISOString())}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={openAdvanceDialog}>Add Advance</Button>
              <Button size="sm" onClick={openSalaryDialog}>Pay Salary</Button>
              <Button size="sm" variant="outline" onClick={() => openEditEmployeeDialog(selectedEmployee)}>
                Edit Employee
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={disableEmployee}
                disabled={selectedEmployee.status === "inactive"}
              >
                Disable Employee
              </Button>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                Overview
              </TabButton>
              <TabButton active={activeTab === "advances"} onClick={() => setActiveTab("advances")}>
                Advances
              </TabButton>
              <TabButton active={activeTab === "salary-history"} onClick={() => setActiveTab("salary-history")}>
                Salary History
              </TabButton>
            </div>
          </div>

          <div className="p-4">
            {activeTab === "overview" && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <InfoTile label="Monthly Salary" value={money(selectedEmployee.monthlySalary)} />
                <InfoTile label="Outstanding Advance" value={money(outstandingAdvances)} />
                <InfoTile label="Last Salary Paid" value={lastSalaryPaid ? money(lastSalaryPaid.netSalary) : "-"} />
                <InfoTile label="Next Salary Date" value={formatDate(getNextSalaryDate(selectedEmployee.salaryDueDay).toISOString())} />
                <InfoTile label="Joining Date" value={formatDate(selectedEmployee.joiningDate)} />
              </div>
            )}

            {activeTab === "advances" && (
              <HistoryTable
                columns={["Date", "Amount", "Payment method", "Given by", "Note", "Status"]}
                emptyText="No salary advances recorded"
                rows={selectedAdvances.map((item) => [
                  formatDateTime(item.advanceDate),
                  money(item.amount),
                  paymentMethodLabels[item.paymentMethod],
                  item.processedBy?.name ?? "-",
                  item.note ?? "-",
                  "Recorded",
                ])}
              />
            )}

            {activeTab === "salary-history" && (
              <HistoryTable
                columns={[
                  "Salary month",
                  "Base salary",
                  "Advance deducted",
                  "Bonus",
                  "Other deductions",
                  "Net paid",
                  "Payment method",
                  "Paid date",
                  "Paid by",
                ]}
                emptyText="No salary payments recorded"
                rows={selectedPayments.map((item) => [
                  item.salaryMonth,
                  money(item.baseSalary),
                  money(item.advancesDeducted),
                  money(item.bonus),
                  money(item.otherDeductions),
                  money(item.netSalary),
                  paymentMethodLabels[item.paymentMethod],
                  formatDateTime(item.paidDate),
                  item.processedBy?.name ?? "-",
                ])}
              />
            )}
          </div>
        </Card>
      )}

      <EmployeeDialog
        open={employeeDialogOpen}
        mode={employeeDialogMode}
        form={employeeForm}
        setForm={setEmployeeForm}
        onOpenChange={setEmployeeDialogOpen}
        onSave={saveEmployee}
      />

      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Advance</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <Input
                type="number"
                min="0"
                value={advanceAmount}
                onChange={(event) => setAdvanceAmount(event.target.value)}
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={advanceDate}
                onChange={(event) => setAdvanceDate(event.target.value)}
              />
            </Field>
            <Field label="Payment Method">
              <PaymentSelect value={advanceMethod} onChange={setAdvanceMethod} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note">
                <Textarea
                  value={advanceNote}
                  onChange={(event) => setAdvanceNote(event.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={addAdvance}>Record Advance</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Salary</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Salary Month">
              <Input
                type="month"
                value={salaryMonth}
                onChange={(event) => setSalaryMonth(event.target.value)}
              />
            </Field>
            <Field label="Paid Date">
              <Input
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </Field>
            <Field label="Base Salary">
              <Input value={baseSalary} disabled />
            </Field>
            <Field label="Outstanding Advances">
              <Input value={outstandingAdvances} disabled />
            </Field>
            <Field label="Advance Deduction">
              <Input
                type="number"
                min="0"
                value={advanceDeduction}
                onChange={(event) => setAdvanceDeduction(event.target.value)}
              />
            </Field>
            <Field label="Bonus">
              <Input
                type="number"
                min="0"
                value={bonus}
                onChange={(event) => setBonus(event.target.value)}
              />
            </Field>
            <Field label="Other Deductions">
              <Input
                type="number"
                min="0"
                value={otherDeductions}
                onChange={(event) => setOtherDeductions(event.target.value)}
              />
            </Field>
            <Field label="Payment Method">
              <PaymentSelect value={salaryMethod} onChange={setSalaryMethod} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-500">
              Net salary{" "}
              <span className="text-lg font-bold text-slate-950">
                {money(netSalary)}
              </span>
            </p>
            <Button onClick={paySalary}>Pay Salary</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function getAdvanceBalance(
  employeeId: string,
  advances: Array<{ employeeId: string; amount: number }>,
  payments: Array<{ employeeId: string; advancesDeducted: number }>
) {
  return Math.max(
    0,
    advances
      .filter((item) => item.employeeId === employeeId)
      .reduce((total, item) => total + item.amount, 0) -
      payments
        .filter((item) => item.employeeId === employeeId)
        .reduce((total, item) => total + item.advancesDeducted, 0)
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">
        {value}
      </p>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PayrollEmployeeStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-semibold ${
        active
          ? "border-slate-950 text-slate-950"
          : "border-transparent text-slate-500 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PaymentSelect({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}) {
  return (
    <select
      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as PaymentMethod)}
    >
      {paymentMethods.map((method) => (
        <option key={method} value={method}>
          {paymentMethodLabels[method]}
        </option>
      ))}
    </select>
  );
}

function EmployeeDialog({
  open,
  mode,
  form,
  setForm,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  mode: EmployeeDialogMode;
  form: PayrollEmployeeInput;
  setForm: Dispatch<SetStateAction<PayrollEmployeeInput>>;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "New Employee" : "Edit Employee"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </Field>
          <Field label="Role">
            <Input
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value }))
              }
            />
          </Field>
          <Field label="Joining Date">
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  joiningDate: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Monthly Salary">
            <Input
              type="number"
              min="0"
              value={form.monthlySalary}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  monthlySalary: Number(event.target.value || 0),
                }))
              }
            />
          </Field>
          <Field label="Salary Due Day">
            <Input
              type="number"
              min="1"
              max="31"
              value={form.salaryDueDay}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  salaryDueDay: Number(event.target.value || 1),
                }))
              }
            />
          </Field>
          <Field label="Status">
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as PayrollEmployeeStatus,
                }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave}>
            {mode === "new" ? "Add Employee" : "Save Employee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row.join("-")}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default StaffPayrollPage;
