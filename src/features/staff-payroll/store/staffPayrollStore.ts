import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getActiveOperatorSnapshot } from "@/lib/operatorAttribution";

import type {
  PayrollEmployee,
  PayrollEmployeeInput,
  SalaryAdvance,
  SalaryAdvanceInput,
  SalaryPayment,
  SalaryPaymentInput,
} from "../types/payroll";

interface StaffPayrollStore {
  employees: PayrollEmployee[];
  salaryAdvances: SalaryAdvance[];
  salaryPayments: SalaryPayment[];
  addEmployee: (input: PayrollEmployeeInput) => PayrollEmployee;
  updateEmployee: (id: string, input: PayrollEmployeeInput) => void;
  recordSalaryAdvance: (input: SalaryAdvanceInput) => SalaryAdvance;
  recordSalaryPayment: (input: SalaryPaymentInput) => SalaryPayment;
  resetStaffPayrollStore: () => void;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useStaffPayrollStore = create<StaffPayrollStore>()(
  persist(
    (set) => ({
      employees: [],
      salaryAdvances: [],
      salaryPayments: [],

      addEmployee: (input) => {
        const now = new Date().toISOString();
        const employee: PayrollEmployee = {
          id: makeId("EMP"),
          ...input,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          employees: [employee, ...state.employees],
        }));

        return employee;
      },

      updateEmployee: (id, input) =>
        set((state) => ({
          employees: state.employees.map((employee) =>
            employee.id === id
              ? {
                  ...employee,
                  ...input,
                  updatedAt: new Date().toISOString(),
                }
              : employee
          ),
        })),

      recordSalaryAdvance: (input) => {
        const advance: SalaryAdvance = {
          id: makeId("ADV"),
          ...input,
          processedBy: getActiveOperatorSnapshot(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          salaryAdvances: [advance, ...state.salaryAdvances],
        }));

        return advance;
      },

      recordSalaryPayment: (input) => {
        const payment: SalaryPayment = {
          id: makeId("SAL"),
          ...input,
          processedBy: getActiveOperatorSnapshot(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          salaryPayments: [payment, ...state.salaryPayments],
        }));

        return payment;
      },

      resetStaffPayrollStore: () =>
        set({
          employees: [],
          salaryAdvances: [],
          salaryPayments: [],
        }),
    }),
    {
      name: "snooker-arena-staff-payroll",
    }
  )
);
