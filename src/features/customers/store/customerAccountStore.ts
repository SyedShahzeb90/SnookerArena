import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  PaymentMethod,
} from "@/types/session";
import {
  formatWalkInBillNumber,
  getWalkInBillPrefix,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import type {
  CustomerAccount,
  CustomerAccessoryCharge,
  CustomerCafeCharge,
  CustomerGameCharge,
  CustomerTotals,
} from "../types/customerAccount";

interface CustomerIdentityInput {
  customerId?: string;
  customerName: string;
  customerNote?: string;
  phone?: string;
}

type NewGameChargeInput = Omit<
  CustomerGameCharge,
  "id" | "payerCustomerId" | "createdAt"
> &
  CustomerIdentityInput;

type NewCafeChargeInput = Omit<
  CustomerCafeCharge,
  "id" | "customerId" | "createdAt"
> &
  CustomerIdentityInput;

interface ReplaceCafeChargesInput
  extends CustomerIdentityInput {
  sourceOrderId: string;
  charges: Omit<
    NewCafeChargeInput,
    | "customerName"
    | "customerNote"
    | "phone"
    | "sourceOrderId"
  >[];
}

interface ReplaceAccessoryChargesInput
  extends ReplaceCafeChargesInput {}

interface MarkPaidInput {
  customerId: string;
  paymentMethod: PaymentMethod;
  activeBusinessDayId?: string;
  saleId?: string;
}

interface CustomerAccountStore {
  accounts: CustomerAccount[];
  nextCustomerTokenSequence: number;
  walkInBillSequences: Record<string, number>;
  createCustomerAccount: (
    input: CustomerIdentityInput
  ) => CustomerAccount;
  updateCustomerAccount: (
    id: string,
    updates: Partial<
      Pick<
        CustomerAccount,
        "customerName" | "customerNote" | "phone"
      >
    >
  ) => void;
  closeCustomerAccount: (id: string) => void;
  cancelCustomerAccount: (input: {
    id: string;
    reason: string;
    note?: string;
  }) => void;
  deleteCustomerAccount: (id: string) => void;
  removeSessionCharges: (
    sessionId: string
  ) => void;
  getActiveCustomerAccounts: () => CustomerAccount[];
  getCustomerById: (
    id: string
  ) => CustomerAccount | undefined;
  findActiveCustomerByNameNotePhone: (
    input: CustomerIdentityInput
  ) => CustomerAccount | undefined;
  getOrCreateActiveCustomer: (
    input: CustomerIdentityInput
  ) => CustomerAccount;
  getOrCreateActiveCustomerByIdOrName: (
    input: CustomerIdentityInput & {
      customerId?: string;
    }
  ) => CustomerAccount;
  addGameChargeToCustomer: (
    input: NewGameChargeInput
  ) => CustomerAccount;
  addCafeChargeToCustomer: (
    input: NewCafeChargeInput
  ) => CustomerAccount;
  replaceCafeChargesForOrder: (
    input: ReplaceCafeChargesInput
  ) => CustomerAccount;
  replaceAccessoryChargesForOrder: (
    input: ReplaceAccessoryChargesInput
  ) => CustomerAccount;
  applyCustomerDiscount: (
    customerId: string,
    discount: number
  ) => void;
  applyAdvanceGamesToBill: (
    customerId: string,
    games: number,
    applicationId: string
  ) => boolean;
  applyFinalGamesToExistingBill: (
    customerId: string,
    games: number,
    settlementId: string
  ) => number;
  undoAdvanceGamesFromBill: (
    customerId: string,
    applicationId: string
  ) => boolean;
  markCustomerBillPaid: (
    input: MarkPaidInput
  ) => void;
  markCustomerBillSettledByAdvance: (
    customerId: string,
    activeBusinessDayId?: string
  ) => void;
  updatePaidBillPaymentMethod: (
    customerId: string,
    paymentMethod: PaymentMethod
  ) => void;
  markCustomerBillCredited: (
    customerId: string
  ) => void;
  calculateCustomerTotals: (
    account: CustomerAccount
  ) => CustomerTotals;
  resetCustomerAccountsForTesting: () => void;
  splitGenericWalkInBills: () => void;
  mergeDuplicateWalkInSessionBills: () => void;
}

export function isActionableCustomerBill(
  account: CustomerAccount
) {
  const hasCharges =
    account.gameCharges.length > 0 ||
    account.cafeCharges.length > 0 ||
    (account.accessoryCharges ?? []).length > 0;

  return (
    account.status === "active" &&
    account.paymentStatus === "unpaid" &&
    hasCharges
  );
}

export const selectActionableCustomerBillCount = (
  state: Pick<CustomerAccountStore, "accounts">
) => state.accounts.filter(isActionableCustomerBill).length;

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function getPhysicalSessionId(sessionId?: string) {
  if (!sessionId) return "";
  return sessionId.split("-TCL-")[0];
}

function generateCustomerToken(sequence: number) {
  return `CUST-${String(sequence).padStart(3, "0")}`;
}

function createStaffBillNumber(
  sequences: Record<string, number> | undefined,
  prefix: string
) {
  const nextSequence =
    ((sequences ?? {})[prefix] ?? 0) + 1;

  return {
    staffBillNumber: formatWalkInBillNumber(
      prefix,
      nextSequence
    ),
    nextSequence,
  };
}

function isGenericWalkIn(input: CustomerIdentityInput) {
  return (
    normalize(input.customerName) ===
      "walk-in customer" &&
    !normalize(input.customerNote) &&
    !normalize(input.phone)
  );
}

function calculateTotals(
  account: Pick<
    CustomerAccount,
    "gameCharges" | "cafeCharges" | "discount"
  > & {
    accessoryCharges?: CustomerAccessoryCharge[];
    advanceReduction?: number;
    finalGamesOffsetReduction?: number;
  }
): CustomerTotals {
  const totalGameAmount =
    Math.max(0, account.gameCharges.reduce(
      (total, charge) => total + charge.amount,
      0
    ) -
      (account.advanceReduction ?? 0) -
      (account.finalGamesOffsetReduction ?? 0));
  const totalCafeAmount =
    account.cafeCharges
      .filter(
        (charge) =>
          !charge.name.startsWith(
            "[Accessory]"
          )
      )
      .reduce(
        (total, charge) => total + charge.subtotal,
        0
      );
  const totalAccessoryAmount =
    [
      ...(account.accessoryCharges ?? []),
      ...account.cafeCharges.filter((charge) =>
        charge.name.startsWith("[Accessory]")
      ),
    ].reduce(
      (total, charge) => total + charge.subtotal,
      0
    );

  return {
    totalGameAmount,
    totalCafeAmount,
    totalAccessoryAmount,
    grandTotal: Math.max(
      0,
      totalGameAmount +
        totalCafeAmount -
        account.discount +
        totalAccessoryAmount
    ),
  };
}

function withTotals(
  account: CustomerAccount
): CustomerAccount {
  const totals = calculateTotals(account);

  return {
    ...account,
    ...totals,
  };
}

function getChargeGameCount(charge: CustomerGameCharge) {
  return charge.gameCount ?? Math.max(
    1,
    Math.round((charge.originalAmount ?? charge.amount) / 300)
  );
}

function getAdvanceReduction(
  charges: CustomerGameCharge[],
  games: number
) {
  let remaining = games;
  return charges.reduce((total, charge) => {
    if (remaining <= 0) return total;
    const gameCount = getChargeGameCount(charge);
    const applied = Math.min(remaining, gameCount);
    remaining -= applied;
    return total +
      ((charge.originalAmount ?? charge.amount) / gameCount) * applied;
  }, 0);
}

function findAccountForOrderInput(
  accounts: CustomerAccount[],
  input: ReplaceCafeChargesInput
) {
  const firstCharge = input.charges[0];

  if (
    !firstCharge?.sessionId ||
    !firstCharge.tableId
  ) {
    return undefined;
  }

  return accounts.find(
    (account) =>
      account.status === "active" &&
      account.paymentStatus === "unpaid" &&
      normalize(account.customerName) ===
        normalize(input.customerName) &&
      [
        ...account.cafeCharges,
        ...(account.accessoryCharges ?? []),
      ].some(
        (charge) =>
          charge.sessionId ===
          firstCharge.sessionId
      )
  );
}

export const useCustomerAccountStore =
  create<CustomerAccountStore>()(
    persist(
      (set, get) => ({
        accounts: [],
        nextCustomerTokenSequence: 1,
        walkInBillSequences: {},

        createCustomerAccount: (input) => {
          const now = new Date().toISOString();
          const customerName =
            input.customerName.trim() ||
            "Walk-in Customer";
          const shouldCreateWalkInNumber =
            isWalkInName(customerName);
          const walkInBill =
            shouldCreateWalkInNumber
              ? createStaffBillNumber(
                  get().walkInBillSequences,
                  "C"
                )
              : undefined;
          const account: CustomerAccount = {
            id: `CUSTACC-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            customerToken: generateCustomerToken(
              get().nextCustomerTokenSequence
            ),
            staffBillNumber:
              walkInBill?.staffBillNumber,
            customerName,
            customerNote:
              input.customerNote?.trim() ||
              undefined,
            phone:
              input.phone?.trim() || undefined,
            status: "active",
            openedAt: now,
            createdAt: now,
            updatedAt: now,
            gameCharges: [],
            cafeCharges: [],
            accessoryCharges: [],
            totalGameAmount: 0,
            totalCafeAmount: 0,
            totalAccessoryAmount: 0,
            discount: 0,
            grandTotal: 0,
            paymentStatus: "unpaid",
            lastActivityAt: now,
            advanceGamesApplied: 0,
            advanceReduction: 0,
          };

          set((state) => ({
            accounts: [
              account,
              ...state.accounts,
            ],
            nextCustomerTokenSequence:
              state.nextCustomerTokenSequence + 1,
            walkInBillSequences: walkInBill
              ? {
                  ...(state.walkInBillSequences ?? {}),
                  C: walkInBill.nextSequence,
                }
              : state.walkInBillSequences ?? {},
          }));

          return account;
        },

        updateCustomerAccount: (
          id,
          updates
        ) =>
          set((state) => ({
            accounts: state.accounts.map(
              (account) =>
                account.id === id
                  ? {
                      ...account,
                      ...updates,
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : account
            ),
          })),

        closeCustomerAccount: (id) =>
          set((state) => ({
            accounts: state.accounts.map(
              (account) =>
                account.id === id
                  ? {
                      ...account,
                      status: "closed",
                      closedAt:
                        new Date().toISOString(),
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : account
            ),
          })),

        cancelCustomerAccount: ({ id, reason, note }) =>
          set((state) => ({
            accounts: state.accounts.map((account) => {
              if (account.id !== id) return account;
              const now = new Date().toISOString();
              return {
                ...account,
                status: "closed",
                closedAt: now,
                cancelledAt: now,
                cancelledReason: reason,
                cancelledNote: note || undefined,
                updatedAt: now,
              };
            }),
          })),

        deleteCustomerAccount: (id) =>
          set((state) => ({
            accounts: state.accounts.filter(
              (account) => account.id !== id
            ),
          })),

        removeSessionCharges: (sessionId) =>
          set((state) => ({
            accounts: state.accounts
              .map((account) =>
                withTotals({
                  ...account,
                  gameCharges:
                    account.gameCharges.filter(
                      (charge) =>
                        charge.sessionId !==
                        sessionId
                    ),
                  cafeCharges:
                    account.cafeCharges.filter(
                      (charge) =>
                        charge.sessionId !==
                        sessionId
                    ),
                  accessoryCharges:
                    (
                      account.accessoryCharges ??
                      []
                    ).filter(
                      (charge) =>
                        charge.sessionId !==
                        sessionId
                    ),
                  updatedAt:
                    new Date().toISOString(),
                })
              )
              .filter(
                (account) =>
                  account.paymentStatus !==
                    "unpaid" ||
                  account.gameCharges.length >
                    0 ||
                  account.cafeCharges.length >
                    0 ||
                  (account.accessoryCharges ?? [])
                    .length > 0
              ),
          })),

        getActiveCustomerAccounts: () =>
          get().accounts.filter(
            (account) =>
              account.status === "active" &&
              account.paymentStatus === "unpaid"
          ),

        getCustomerById: (id) =>
          get().accounts.find(
            (account) => account.id === id
          ),

        findActiveCustomerByNameNotePhone: (
          input
        ) =>
          get().accounts.find(
            (account) =>
              account.status === "active" &&
              account.paymentStatus === "unpaid" &&
              normalize(account.customerName) ===
                normalize(input.customerName) &&
              normalize(account.customerNote) ===
                normalize(input.customerNote) &&
              normalize(account.phone) ===
                normalize(input.phone)
          ),

        getOrCreateActiveCustomer: (input) => {
          if (isGenericWalkIn(input)) {
            return get().createCustomerAccount(
              input
            );
          }

          const existing =
            get().findActiveCustomerByNameNotePhone(
              input
            );

          if (existing) return existing;

          return get().createCustomerAccount(
            input
          );
        },

        getOrCreateActiveCustomerByIdOrName: (
          input
        ) => {
          if (input.customerId) {
            let existing = get().accounts.find(
              (account) =>
                account.id === input.customerId &&
                account.status === "active" &&
                account.paymentStatus ===
                  "unpaid"
            );

            if (existing) return existing;

            const closedUnpaidCustomer = get().accounts.find(
              (account) =>
                account.id === input.customerId &&
                account.status === "closed" &&
                account.paymentStatus === "unpaid"
            );
            if (closedUnpaidCustomer) {
              existing = {
                ...closedUnpaidCustomer,
                status: "active",
                closedAt: undefined,
                updatedAt: new Date().toISOString(),
              };
              set((state) => ({
                accounts: state.accounts.map((account) =>
                  account.id === existing!.id ? existing! : account
                ),
              }));
              return existing;
            }

            const paidCustomer = get().accounts.find(
              (account) =>
                account.id === input.customerId &&
                account.status === "closed" &&
                account.paymentStatus === "paid"
            );
            if (paidCustomer) {
              const now = new Date().toISOString();
              existing = withTotals({
                ...paidCustomer,
                status: "active",
                paymentStatus: "unpaid",
                openedAt: now,
                closedAt: undefined,
                paidAt: undefined,
                paymentMethod: undefined,
                activeBusinessDayId: undefined,
                saleId: undefined,
                gameCharges: [],
                cafeCharges: [],
                accessoryCharges: [],
                discount: 0,
                advanceGamesApplied: 0,
                advanceReduction: 0,
                advanceApplicationId: undefined,
                updatedAt: now,
              });
              set((state) => ({
                accounts: state.accounts.map((account) =>
                  account.id === existing!.id ? existing! : account
                ),
              }));
              return existing;
            }
          }

          return get().getOrCreateActiveCustomer(
            input
          );
        },

        addGameChargeToCustomer: (input) => {
          const customer =
            get().getOrCreateActiveCustomerByIdOrName(
              input
            );
          const now = new Date().toISOString();
          const charge: CustomerGameCharge = {
            ...input,
            id: `GAME-${input.sessionId}-${customer.id}-${Date.now()}`,
            payerCustomerId: customer.id,
            createdAt: now,
          };
          let nextAccount = customer;

          set((state) => {
            let sequencePrefix = "";
            let sequenceValue:
              | number
              | undefined;

            return {
              accounts: state.accounts.map(
                (account) => {
                if (account.id !== customer.id) {
                  return account;
                }

                const shouldUseTableBillNumber =
                  isWalkInName(account.customerName) &&
                  (!account.staffBillNumber ||
                    account.staffBillNumber.startsWith(
                      "C-WI-"
                    ));
                const prefix =
                  shouldUseTableBillNumber
                    ? getWalkInBillPrefix({
                        tableId: input.tableId,
                        tableName: input.tableName,
                        tableType: input.tableType,
                      })
                    : "";
                const walkInBill =
                  shouldUseTableBillNumber
                    ? createStaffBillNumber(
                        state.walkInBillSequences,
                        prefix
                      )
                    : undefined;
                sequencePrefix = prefix;
                sequenceValue =
                  walkInBill?.nextSequence;

                nextAccount = withTotals({
                  ...account,
                  staffBillNumber:
                    walkInBill?.staffBillNumber ??
                    account.staffBillNumber,
                  gameCharges: [
                    ...account.gameCharges.filter(
                      (item) => {
                        if (
                          item.sessionId !== input.sessionId ||
                          item.payerName !== input.payerName
                        ) {
                          return true;
                        }

                        const incomingFrameIds =
                          input.sourceFrameIds ?? [];
                        const existingFrameIds =
                          item.sourceFrameIds ?? [];

                        if (
                          incomingFrameIds.length > 0 &&
                          existingFrameIds.length > 0
                        ) {
                          return !incomingFrameIds.some((frameId) =>
                            existingFrameIds.includes(frameId)
                          );
                        }

                        return false;
                      }
                    ),
                    charge,
                  ],
                  lastTableName:
                    input.tableName,
                  lastActivityAt:
                    input.endedAt,
                  updatedAt: now,
                });

                return nextAccount;
              }
              ),
              walkInBillSequences:
              sequencePrefix && sequenceValue
                ? {
                    ...(state.walkInBillSequences ?? {}),
                    [sequencePrefix]: sequenceValue,
                  }
                : state.walkInBillSequences ?? {},
            };
          });

          return nextAccount;
        },

        addCafeChargeToCustomer: (input) => {
          const customer =
            get().getOrCreateActiveCustomerByIdOrName(
              input
            );
          const now = new Date().toISOString();
          const charge: CustomerCafeCharge = {
            ...input,
            id: `CAFE-${input.itemId}-${customer.id}-${Date.now()}`,
            customerId: customer.id,
            createdAt: now,
          };
          let nextAccount = customer;

          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (account.id !== customer.id) {
                  return account;
                }

                nextAccount = withTotals({
                  ...account,
                  cafeCharges: [
                    ...account.cafeCharges.filter(
                      (item) =>
                        !(
                          item.sourceOrderId &&
                          item.sourceOrderId ===
                            input.sourceOrderId
                        )
                    ),
                    charge,
                  ],
                  lastTableName:
                    input.tableName ??
                    account.lastTableName,
                  lastActivityAt:
                    input.orderedAt,
                  updatedAt: now,
                });

                return nextAccount;
              }
            ),
          }));

          return nextAccount;
        },

        replaceCafeChargesForOrder: (
          input
        ) => {
          const existingOrderCustomer =
            get().accounts.find(
              (account) =>
                account.status === "active" &&
                account.paymentStatus ===
                  "unpaid" &&
                account.cafeCharges.some(
                  (charge) =>
                    charge.sourceOrderId ===
                    input.sourceOrderId
                )
            );
          const customer =
            existingOrderCustomer ??
            (!input.customerId
              ? findAccountForOrderInput(
                  get().accounts,
                  input
                )
              : undefined) ??
            get().getOrCreateActiveCustomerByIdOrName(
              input
            );
          const now = new Date().toISOString();
          const charges =
            input.charges.map((charge) => ({
              ...charge,
              id: `CAFE-${charge.itemId}-${customer.id}-${input.sourceOrderId}`,
              customerId: customer.id,
              customerName:
                customer.customerName,
              sourceOrderId:
                input.sourceOrderId,
              createdAt: now,
            }));
          let nextAccount = customer;

          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (account.id !== customer.id) {
                  return account;
                }

                nextAccount = withTotals({
                  ...account,
                  cafeCharges: [
                    ...account.cafeCharges.filter(
                      (item) =>
                        item.sourceOrderId !==
                        input.sourceOrderId
                    ),
                    ...charges,
                  ],
                  lastTableName:
                    charges[0]?.tableName ??
                    account.lastTableName,
                  lastActivityAt:
                    charges[0]?.orderedAt ?? now,
                  updatedAt: now,
                });

                return nextAccount;
              }
            ),
          }));

          return nextAccount;
        },

        replaceAccessoryChargesForOrder: (
          input
        ) => {
          const existingOrderCustomer =
            get().accounts.find(
              (account) =>
                account.status === "active" &&
                account.paymentStatus ===
                  "unpaid" &&
                (account.accessoryCharges ?? []).some(
                  (charge) =>
                    charge.sourceOrderId ===
                    input.sourceOrderId
                )
            );
          const customer =
            existingOrderCustomer ??
            (!input.customerId
              ? findAccountForOrderInput(
                  get().accounts,
                  input
                )
              : undefined) ??
            get().getOrCreateActiveCustomerByIdOrName(
              input
            );
          const now = new Date().toISOString();
          const charges =
            input.charges.map((charge) => ({
              ...charge,
              id: `ACCESSORY-${charge.itemId}-${customer.id}-${input.sourceOrderId}`,
              customerId: customer.id,
              customerName:
                customer.customerName,
              sourceOrderId:
                input.sourceOrderId,
              createdAt: now,
            }));
          let nextAccount = customer;

          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (account.id !== customer.id) {
                  return account;
                }

                nextAccount = withTotals({
                  ...account,
                  cafeCharges:
                    account.cafeCharges.filter(
                      (item) =>
                        item.sourceOrderId !==
                        input.sourceOrderId
                    ),
                  accessoryCharges: [
                    ...(account.accessoryCharges ?? []).filter(
                      (item) =>
                        item.sourceOrderId !==
                        input.sourceOrderId
                    ),
                    ...charges,
                  ],
                  lastTableName:
                    charges[0]?.tableName ??
                    account.lastTableName,
                  lastActivityAt:
                    charges[0]?.orderedAt ?? now,
                  updatedAt: now,
                });

                return nextAccount;
              }
            ),
          }));

          return nextAccount;
        },

        applyCustomerDiscount: (
          customerId,
          discount
        ) =>
          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (account.id !== customerId) {
                  return account;
                }

                const eligibleDiscount = Math.min(
                  Math.max(0, discount),
                  account.totalGameAmount +
                    account.totalCafeAmount
                );

                return withTotals({
                  ...account,
                  discount: eligibleDiscount,
                  updatedAt:
                    new Date().toISOString(),
                });
              }
            ),
          })),

        applyAdvanceGamesToBill: (customerId, games, applicationId) => {
          const account = get().accounts.find((item) => item.id === customerId);
          if (!account || account.status !== "active" || account.paymentStatus !== "unpaid") return false;
          if (account.advanceApplicationId || !Number.isInteger(games) || games < 1) return false;
          const eligibleGames = account.gameCharges.reduce(
            (sum, charge) => sum + getChargeGameCount(charge),
            0
          );
          if (games > eligibleGames) return false;
          set((state) => ({
            accounts: state.accounts.map((item) => item.id === customerId
              ? withTotals({
                  ...item,
                  advanceGamesApplied: games,
                  advanceReduction: getAdvanceReduction(item.gameCharges, games),
                  advanceApplicationId: applicationId,
                  updatedAt: new Date().toISOString(),
                })
              : item),
          }));
          return true;
        },

        applyFinalGamesToExistingBill: (
          customerId,
          games,
          settlementId
        ) => {
          const account = get().accounts.find(
            (item) => item.id === customerId
          );
          if (
            !account ||
            account.status !== "active" ||
            account.paymentStatus !== "unpaid" ||
            !Number.isInteger(games) ||
            games < 1 ||
            (account.finalGamesOffsetIds ?? []).includes(settlementId)
          ) {
            return 0;
          }

          const totalGames = account.gameCharges.reduce(
            (sum, charge) => sum + getChargeGameCount(charge),
            0
          );
          const alreadyOffsetGames =
            (account.advanceGamesApplied ?? 0) +
            (account.finalGamesOffsetApplied ?? 0);
          const appliedGames = Math.min(
            games,
            Math.max(0, totalGames - alreadyOffsetGames)
          );

          if (appliedGames < 1) return 0;

          const previousReduction = getAdvanceReduction(
            account.gameCharges,
            alreadyOffsetGames
          );
          const nextReduction = getAdvanceReduction(
            account.gameCharges,
            alreadyOffsetGames + appliedGames
          );
          const now = new Date().toISOString();

          set((state) => ({
            accounts: state.accounts.map((item) =>
              item.id === customerId
                ? withTotals({
                    ...item,
                    finalGamesOffsetApplied:
                      (item.finalGamesOffsetApplied ?? 0) + appliedGames,
                    finalGamesOffsetReduction:
                      (item.finalGamesOffsetReduction ?? 0) +
                      (nextReduction - previousReduction),
                    finalGamesOffsetIds: [
                      ...(item.finalGamesOffsetIds ?? []),
                      settlementId,
                    ],
                    updatedAt: now,
                  })
                : item
            ),
          }));

          return appliedGames;
        },

        undoAdvanceGamesFromBill: (customerId, applicationId) => {
          const account = get().accounts.find((item) => item.id === customerId);
          if (!account || account.status !== "active" || account.paymentStatus !== "unpaid" || account.advanceApplicationId !== applicationId) return false;
          set((state) => ({
            accounts: state.accounts.map((item) => item.id === customerId
              ? withTotals({
                  ...item,
                  advanceGamesApplied: 0,
                  advanceReduction: 0,
                  advanceApplicationId: undefined,
                  updatedAt: new Date().toISOString(),
                })
              : item),
          }));
          return true;
        },

        markCustomerBillPaid: (input) =>
          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (
                  account.id !==
                  input.customerId
                ) {
                  return account;
                }

                const now =
                  new Date().toISOString();

                return {
                  ...withTotals(account),
                  status: "closed",
                  closedAt: now,
                  updatedAt: now,
                  paymentStatus: "paid",
                  paymentMethod:
                    input.paymentMethod,
                  paidAt: now,
                  activeBusinessDayId:
                    input.activeBusinessDayId,
                  saleId: input.saleId,
                };
              }
            ),
          })),

        markCustomerBillSettledByAdvance: (
          customerId,
          activeBusinessDayId
        ) =>
          set((state) => ({
            accounts: state.accounts.map((account) => {
              if (account.id !== customerId) {
                return account;
              }

              const settledAccount = withTotals(account);

              if (
                settledAccount.paymentStatus !== "unpaid" ||
                settledAccount.grandTotal > 0 ||
                (
                  !settledAccount.advanceGamesApplied &&
                  !settledAccount.finalGamesOffsetApplied
                )
              ) {
                return account;
              }

              const now = new Date().toISOString();

              return {
                ...settledAccount,
                status: "closed",
                closedAt: now,
                updatedAt: now,
                paymentStatus: "paid",
                paidAt: now,
                activeBusinessDayId,
              };
            }),
          })),

        updatePaidBillPaymentMethod: (
          customerId,
          paymentMethod
        ) =>
          set((state) => ({
            accounts: state.accounts.map((account) =>
              account.id === customerId &&
              account.paymentStatus === "paid"
                ? {
                    ...account,
                    paymentMethod,
                    updatedAt: new Date().toISOString(),
                  }
                : account
            ),
          })),

        markCustomerBillCredited: (customerId) =>
          set((state) => ({
            accounts: state.accounts.map(
              (account) => {
                if (account.id !== customerId) {
                  return account;
                }

                const now =
                  new Date().toISOString();

                return {
                  ...withTotals(account),
                  status: "closed",
                  closedAt: now,
                  updatedAt: now,
                  paymentStatus: "unpaid",
                };
              }
            ),
          })),

        calculateCustomerTotals:
          calculateTotals,

        resetCustomerAccountsForTesting: () =>
          set({
            accounts: [],
            nextCustomerTokenSequence: 1,
            walkInBillSequences: {},
          }),

        mergeDuplicateWalkInSessionBills: () =>
          set((state) => {
            const grouped = new Map<
              string,
              CustomerAccount[]
            >();

            state.accounts.forEach((account) => {
              const allCharges = [
                ...account.gameCharges,
                ...account.cafeCharges,
                ...(account.accessoryCharges ?? []),
              ];
              const firstSessionCharge =
                allCharges.find(
                  (charge) =>
                    "sessionId" in charge &&
                    charge.sessionId &&
                    "tableId" in charge &&
                    charge.tableId
                );

              if (
                account.status !== "active" ||
                account.paymentStatus !== "unpaid" ||
                !isWalkInName(account.customerName) ||
                !firstSessionCharge ||
                !(
                  "sessionId" in
                  firstSessionCharge
                ) ||
                !(
                  "tableId" in
                  firstSessionCharge
                )
              ) {
                grouped.set(account.id, [
                  account,
                ]);
                return;
              }

              const key = `walkin-${firstSessionCharge.tableId}-${getPhysicalSessionId(firstSessionCharge.sessionId)}`;
              grouped.set(key, [
                ...(grouped.get(key) ?? []),
                account,
              ]);
            });

            return {
              accounts: Array.from(
                grouped.values()
              ).map((group) => {
                if (group.length === 1) {
                  return group[0];
                }

                const [primary] = group;
                const merged =
                  withTotals({
                    ...primary,
                    gameCharges:
                      group.flatMap(
                        (account) =>
                          account.gameCharges
                      ),
                    cafeCharges:
                      group.flatMap(
                        (account) =>
                          account.cafeCharges
                      ),
                    accessoryCharges:
                      group.flatMap(
                        (account) =>
                          account.accessoryCharges ??
                          []
                      ),
                    updatedAt:
                      new Date().toISOString(),
                    lastActivityAt:
                      group
                        .map(
                          (account) =>
                            account.lastActivityAt ??
                            account.updatedAt
                        )
                        .sort()
                        .at(-1),
                  });

                return merged;
              }),
            };
          }),

        splitGenericWalkInBills: () =>
          set((state) => {
            let nextSequence =
              state.nextCustomerTokenSequence;
            const nextAccounts =
              state.accounts.flatMap((account) => {
                const shouldSplit =
                  account.status === "active" &&
                  account.paymentStatus ===
                    "unpaid" &&
                  isWalkInName(account.customerName) &&
                  !account.customerNote &&
                  !account.phone &&
                  account.gameCharges.length > 1 &&
                  account.cafeCharges.length === 0 &&
                  new Set(
                    account.gameCharges.map((charge) =>
                      getPhysicalSessionId(charge.sessionId)
                    )
                  ).size > 1;

                if (!shouldSplit) {
                  return [account];
                }

                return account.gameCharges.map(
                  (charge) => {
                    const id = `CUSTACC-${Date.now()}-${Math.random()
                      .toString(36)
                      .slice(2, 8)}`;
                    const splitCharge = {
                      ...charge,
                      payerCustomerId: id,
                    };
                    const splitAccount =
                      withTotals({
                        ...account,
                        id,
                        customerToken:
                          generateCustomerToken(
                            nextSequence
                          ),
                        openedAt:
                          charge.createdAt,
                        createdAt:
                          charge.createdAt,
                        updatedAt:
                          charge.createdAt,
                        gameCharges: [
                          splitCharge,
                        ],
                        cafeCharges: [],
                        lastTableName:
                          charge.tableName,
                        lastActivityAt:
                          charge.endedAt,
                      });

                    nextSequence += 1;
                    return splitAccount;
                  }
                );
              });

            return {
              accounts: nextAccounts,
              nextCustomerTokenSequence:
                nextSequence,
            };
          }),
      }),
      {
        name: "snooker-arena-customer-accounts",
      }
    )
  );
