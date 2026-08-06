import type { PaymentMethod } from "@/types/session";
import type { OperatorSnapshot } from "@/types/operatorAudit";

export type PayrollEmployeeStatus = "active" | "inactive";

export interface PayrollEmployee {
  id: string;
  name: string;
  phone: string;
  role: string;
  joiningDate: string;
  monthlySalary: number;
  salaryDueDay: number;
  status: PayrollEmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  amount: number;
  advanceDate: string;
  note?: string;
  paymentMethod: PaymentMethod;
  activeBusinessDayId?: string;
  processedBy?: OperatorSnapshot;
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  salaryMonth: string;
  baseSalary: number;
  advancesDeducted: number;
  bonus: number;
  otherDeductions: number;
  netSalary: number;
  paymentMethod: PaymentMethod;
  paidDate: string;
  activeBusinessDayId?: string;
  processedBy?: OperatorSnapshot;
  createdAt: string;
}

export type PayrollEmployeeInput = Omit<
  PayrollEmployee,
  "id" | "createdAt" | "updatedAt"
>;

export type SalaryAdvanceInput = Omit<
  SalaryAdvance,
  "id" | "processedBy" | "createdAt"
>;

export type SalaryPaymentInput = Omit<
  SalaryPayment,
  "id" | "processedBy" | "createdAt"
>;
