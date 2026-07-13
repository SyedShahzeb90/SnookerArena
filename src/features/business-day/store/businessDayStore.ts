import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  BusinessDay,
  BusinessDaySummary,
  CloseBusinessDayInput,
  StartBusinessDayInput,
} from "../types/businessDay";

const emptySummary: BusinessDaySummary = {
  totalSales: 0,
  tableSales: 0,
  cafeSales: 0,
  cashSales: 0,
  cardSales: 0,
  jazzCashSales: 0,
  easypaisaSales: 0,
  completedPaymentsCount: 0,
  totalExpenses: 0,
  cashExpenses: 0,
  expenseCount: 0,
  pendingBillsCount: 0,
  pendingBillsAmount: 0,
  expectedCash: 0,
  netProfit: 0,
};

interface BusinessDayStore {
  days: BusinessDay[];
  message?: string;
  startBusinessDay: (
    input: StartBusinessDayInput
  ) => BusinessDay | null;
  closeBusinessDay: (
    input: CloseBusinessDayInput
  ) => BusinessDay | null;
  getActiveBusinessDay: () =>
    | BusinessDay
    | undefined;
  getBusinessDayHistory: () => BusinessDay[];
  calculateBusinessDaySummary: (
    dayId: string
  ) => BusinessDaySummary;
  updateBusinessDayNotes: (
    dayId: string,
    notes: {
      openingNotes?: string;
      closingNotes?: string;
    }
  ) => void;
  getLastClosedBusinessDay: () =>
    | BusinessDay
    | undefined;
  resetBusinessDayStore: () => void;
}

function makeDayName(date: Date) {
  return date.toLocaleDateString("en-PK", {
    dateStyle: "medium",
  });
}

export const useBusinessDayStore =
  create<BusinessDayStore>()(
    persist(
      (set, get) => ({
        days: [],

        startBusinessDay: (input) => {
          const active =
            get().getActiveBusinessDay();

          if (active) {
            set({
              message:
                "A business day is already active.",
            });
            return null;
          }

          const now = new Date();
          const day: BusinessDay = {
            id: `BD-${Date.now()}`,
            dayName: makeDayName(now),
            startedAt: now.toISOString(),
            status: "active",
            openedBy: input.openedBy,
            openingCash: input.openingCash,
            openingNotes:
              input.openingNotes,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            ...emptySummary,
            expectedCash: input.openingCash,
          };

          set((state) => ({
            days: [day, ...state.days],
            message: undefined,
          }));

          return day;
        },

        closeBusinessDay: (input) => {
          const active =
            get().getActiveBusinessDay();

          if (!active) return null;

          const summary =
            input.summary ?? active;
          const now = new Date();
          const cashTakenHome =
            input.actualCashCounted -
            input.cashLeftForStaff;
          const cashDifference =
            input.actualCashCounted -
            summary.expectedCash;
          const closedDay: BusinessDay = {
            ...active,
            ...summary,
            status: "closed",
            endedAt: now.toISOString(),
            closedBy: input.closedBy,
            actualCashCounted:
              input.actualCashCounted,
            cashLeftForStaff:
              input.cashLeftForStaff,
            cashTakenHome,
            cashDifference,
            closingNotes:
              input.closingNotes,
            updatedAt: now.toISOString(),
          };

          set((state) => ({
            days: state.days.map((day) =>
              day.id === active.id
                ? closedDay
                : day
            ),
            message:
              "Business day closed successfully.",
          }));

          return closedDay;
        },

        getActiveBusinessDay: () =>
          get().days.find(
            (day) => day.status === "active"
          ),

        getBusinessDayHistory: () =>
          get().days,

        calculateBusinessDaySummary: (dayId) => {
          const day = get().days.find(
            (item) => item.id === dayId
          );

          if (!day) return emptySummary;
          return day;
        },

        updateBusinessDayNotes: (
          dayId,
          notes
        ) =>
          set((state) => ({
            days: state.days.map((day) =>
              day.id === dayId
                ? {
                    ...day,
                    ...notes,
                    updatedAt:
                      new Date().toISOString(),
                  }
                : day
            ),
          })),

        getLastClosedBusinessDay: () =>
          get().days.find(
            (day) => day.status === "closed"
          ),

        resetBusinessDayStore: () =>
          set({
            days: [],
            message: undefined,
          }),
      }),
      {
        name: "snooker-arena-business-day",
      }
    )
  );
