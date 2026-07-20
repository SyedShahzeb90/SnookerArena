import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pencil,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PaymentMethod,
  SessionType,
} from "@/types/session";

import { useTableStore } from "@/store/tableStore";
import { useCafeStore } from "./store/cafeStore";
import {
  getSessionPlayerEntries,
  getSessionPlayers,
} from "@/features/sessions/utils/sessionPlayers";
import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import { normalizePlayerName } from "./utils/playerIdentity";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import {
  getBillPrimaryLabel,
  getBillCustomerLabel,
  getBillSearchText,
  getBillSecondaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";

import MenuPanel from "./components/MenuPanel";
import OrderCart from "./components/OrderCart";

type SelectedTarget =
  | {
      type: "runningTable";
      tableId: number;
      sessionId: string;
      playerName: string;
      customerId?: string;
    }
  | {
      type: "waitingCustomer";
      customerId: string;
      customerAccountId?: string;
      billNo?: string;
      customerName?: string;
    }
  | {
      type: "openBill";
      customerAccountId: string;
      billNo?: string;
      customerName?: string;
    }
  | null;

function CafePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tables = useTableStore(
    (state) => state.tables
  );
  const updateSessionCafe =
    useTableStore(
      (state) => state.updateSessionCafe
    );
  const startSession =
    useTableStore(
      (state) => state.startSession
    );
  const activeBusinessDay =
    useBusinessDayStore((state) =>
      state.getActiveBusinessDay()
    );
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const closeCustomerAccount =
    useCustomerAccountStore(
      (state) => state.closeCustomerAccount
    );

  const {
    waitingCustomers,
    getPlayerOrder,
    getWaitingCustomerOrder,
    addItemToPlayer,
    increasePlayerItem,
    decreasePlayerItem,
    addItemToWaitingCustomer,
    increaseWaitingItem,
    decreaseWaitingItem,
    saveOrder,
    savedOrders,
    receiveWaitingCustomerPayment,
    playerOrders,
    getTableOrderItems,
    getSavedOrderForTable,
  } = useCafeStore();

  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] =
    useState<SelectedTarget>(null);
  const [
    openBillCarts,
    setOpenBillCarts,
  ] = useState<Record<string, typeof waitingCustomers[number]["orderItems"]>>({});
  const [expandedTable, setExpandedTable] =
    useState<number | null>(null);
  const [orderMessage, setOrderMessage] =
    useState("");
  const [orderError, setOrderError] =
    useState("");
  const [lastSavedTotal, setLastSavedTotal] =
    useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod | "">("");
  const [
    openBillsExpanded,
    setOpenBillsExpanded,
  ] = useState(true);
  const [
    paymentDialogOpen,
    setPaymentDialogOpen,
  ] = useState(false);
  const [
    attachDialogOpen,
    setAttachDialogOpen,
  ] = useState(false);
  const [
    newCustomerDialogOpen,
    setNewCustomerDialogOpen,
  ] = useState(false);
  const [
    newCustomerText,
    setNewCustomerText,
  ] = useState("");
  const [attachTableId, setAttachTableId] =
    useState("");
  const [
    attachSessionType,
    setAttachSessionType,
  ] = useState<SessionType>("single");
  const previousSelectedTargetKey =
    useRef("");
  const previousUrlTableTargetKey =
    useRef("");
  const selectedTargetKey =
    selectedTarget?.type === "runningTable"
      ? `runningTable-${selectedTarget.tableId}-${selectedTarget.sessionId}-${selectedTarget.customerId ?? normalizePlayerName(selectedTarget.playerName)}`
      : selectedTarget?.type === "waitingCustomer"
        ? `waitingCustomer-${selectedTarget.customerId}-${selectedTarget.customerAccountId ?? ""}`
        : selectedTarget?.type === "openBill"
          ? `openBill-${selectedTarget.customerAccountId}`
        : "";

  const runningTables = useMemo(() => {
    const query = search.toLowerCase();

    return tables.filter((table) => {
      if (!table.session) return false;

      return (
        table.name
          .toLowerCase()
          .includes(query) ||
        getSessionPlayers(table.session).some(
          (player) =>
            player
              .toLowerCase()
              .includes(query)
        )
      );
    });
  }, [tables, search]);

  const filteredWaiting =
    waitingCustomers.filter((customer) => {
      const account =
        customerAccounts.find(
          (item) => item.id === customer.id
        );

      if (
        account &&
        account.grandTotal > 0
      ) {
        return false;
      }

      const query = search.toLowerCase();

      return (
        customer.name
          .toLowerCase()
          .includes(query) ||
        (account
          ? getBillSearchText(account).includes(
              query
            )
          : false)
      );
    });

  const getWaitingCustomerAccount = (
    customerId: string
  ) =>
    customerAccounts.find(
      (account) => account.id === customerId
    );

  const getWaitingCustomerLabels = (
    customer: (typeof waitingCustomers)[number]
  ) => {
    const account =
      getWaitingCustomerAccount(customer.id);

    if (!account) {
      return {
        primary: customer.name,
        secondary: "",
      };
    }

    return {
      primary:
        account.customerName ===
        "Walk-in Customer"
          ? account.customerToken
          : account.customerName,
      secondary: [
        account.customerName ===
        "Walk-in Customer"
          ? account.customerName
          : account.customerToken,
        account.customerNote,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  };

  const handleDeleteWaitingCustomer = (
    customerId: string
  ) => {
    const customer =
      waitingCustomers.find(
        (item) => item.id === customerId
      );

    if (!customer) return;

    if (
      customer.orderItems.length > 0 &&
      !window.confirm(
        `Delete ${customer.name} and its current cart?`
      )
    ) {
      return;
    }

    useCafeStore.setState((state) => ({
      waitingCustomers:
        state.waitingCustomers.filter(
          (item) => item.id !== customerId
        ),
      savedOrders: state.savedOrders.filter(
        (order) =>
          order.customerAccountId !== customerId
      ),
    }));

    const account =
      getWaitingCustomerAccount(customerId);

    if (
      account &&
      account.gameCharges.length === 0 &&
      account.cafeCharges.length === 0 &&
      (account.accessoryCharges ?? []).length ===
        0
    ) {
      useCustomerAccountStore.setState(
        (state) => ({
          accounts: state.accounts.filter(
            (item) => item.id !== customerId
          ),
        })
      );
    }

    if (
      selectedTarget?.type === "waitingCustomer" &&
      selectedTarget.customerId === customerId
    ) {
      setSelectedTarget(null);
    }
  };

  const handleEditWaitingCustomer = (
    customerId: string
  ) => {
    const customer =
      waitingCustomers.find(
        (item) => item.id === customerId
      );

    if (!customer) return;

    const account =
      getWaitingCustomerAccount(customerId);
    const currentValue =
      account?.customerNote ||
      (account?.customerName !==
      "Walk-in Customer"
        ? account?.customerName
        : "") ||
      customer.name;
    const input = prompt(
      "Customer name or note",
      currentValue
    );

    if (input === null) return;

    const value = input.trim();
    const isNamedCustomer =
      !!value && !value.includes(" ");
    const nextName = isNamedCustomer
      ? value
      : "Walk-in Customer";
    const nextNote =
      value && !isNamedCustomer
        ? value
        : undefined;

    useCafeStore.setState((state) => ({
      waitingCustomers:
        state.waitingCustomers.map((item) =>
          item.id === customerId
            ? {
                ...item,
                name: nextName,
              }
            : item
        ),
    }));

    if (account) {
      useCustomerAccountStore
        .getState()
        .updateCustomerAccount(
          account.id,
          {
            customerName: nextName,
            customerNote: nextNote,
          }
        );
    }
  };

  const openCustomerBills = useMemo(
    () =>
      customerAccounts.filter(
        (account) =>
          account.status === "active" &&
          account.paymentStatus === "unpaid" &&
          account.grandTotal > 0
      ),
    [customerAccounts]
  );

  const filteredOpenCustomerBills =
    openCustomerBills.filter((customer) => {
      const query = search.toLowerCase();

      return getBillSearchText(customer).includes(
        query
      );
    });

  useEffect(() => {
    if (!orderMessage) return;

    const timeout = window.setTimeout(
      () => setOrderMessage(""),
      3000
    );

    return () =>
      window.clearTimeout(timeout);
  }, [orderMessage]);

  useEffect(() => {
    if (
      previousSelectedTargetKey.current &&
      previousSelectedTargetKey.current !==
        selectedTargetKey
    ) {
      setOrderMessage("");
    }

    previousSelectedTargetKey.current =
      selectedTargetKey;
  }, [selectedTargetKey]);

  useEffect(() => {
    useTableStore
      .getState()
      .tables.forEach((table) => {
      if (!table.session) return;

      updateSessionCafe({
        tableId: table.id,
        cafeOrders:
          getTableOrderItems(table.id),
      });
    });
  }, [
    playerOrders,
    getTableOrderItems,
    updateSessionCafe,
  ]);

  const savedTableOrder =
    selectedTarget?.type === "runningTable"
      ? getSavedOrderForTable(
          selectedTarget.tableId,
          selectedTarget.sessionId,
          selectedTarget.playerName,
          selectedTarget.customerId
        )
      : undefined;

  const selectedOrder =
    selectedTarget?.type === "runningTable"
      ? getPlayerOrder(
          selectedTarget.tableId,
          selectedTarget.playerName,
          selectedTarget.customerId
        ) ?? savedTableOrder
      : selectedTarget?.type === "waitingCustomer"
        ? getWaitingCustomerOrder(
            selectedTarget.customerId
          )
        : selectedTarget?.type === "openBill"
          ? {
              id: selectedTarget.customerAccountId,
              name: selectedTarget.customerName ?? "",
              orderItems:
                openBillCarts[
                  selectedTarget.customerAccountId
                ] ?? [],
              totalAmount:
                openBillCarts[
                  selectedTarget.customerAccountId
                ]?.reduce(
                  (sum, item) =>
                    sum + item.subtotal,
                  0
                ) ?? 0,
            }
          : undefined;

  const selectedBillAccount =
    selectedTarget?.type === "openBill"
      ? openCustomerBills.find(
          (customer) =>
            customer.id ===
            selectedTarget.customerAccountId
        )
      : selectedTarget?.type ===
            "waitingCustomer" &&
          selectedTarget.customerAccountId
        ? openCustomerBills.find(
            (customer) =>
              customer.id ===
              selectedTarget.customerAccountId
          )
      : undefined;
  const selectedPanelAccount =
    selectedBillAccount ??
    (selectedTarget?.type ===
      "waitingCustomer" &&
    selectedTarget.customerAccountId
      ? customerAccounts.find(
          (account) =>
            account.id ===
            selectedTarget.customerAccountId
        )
      : undefined);
  const selectedWaitingAccount =
    selectedTarget?.type ===
      "waitingCustomer" &&
    selectedTarget.customerAccountId
      ? customerAccounts.find(
          (account) =>
            account.id ===
            selectedTarget.customerAccountId
        )
      : undefined;
  const selectedAttachAccount =
    selectedWaitingAccount ??
    selectedBillAccount;
  const attachableTables = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.status === "available" &&
          !table.session
      ),
    [tables]
  );

  const getAttachBlockedMessage = (
    table: (typeof tables)[number]
  ) => {
    if (table.status === "payment-pending") {
      return `${table.name} has a pending bill. Clear payment first.`;
    }

    if (table.status === "reserved") {
      return `${table.name} is reserved.`;
    }

    if (table.status === "maintenance") {
      return `${table.name} is under maintenance.`;
    }

    if (
      table.status === "running" ||
      table.status === "paused" ||
      table.session
    ) {
      return `${table.name} is not available. Another customer is currently playing.`;
    }

    return `${table.name} is not available.`;
  };

  const selectedCartTotal =
    selectedOrder?.totalAmount ?? 0;
  const selectedSavedCafeItems =
    selectedPanelAccount?.cafeCharges
      .filter(
        (charge) =>
          !charge.name.startsWith(
            "[Accessory]"
          )
      )
      .map((charge) => ({
        menuItemId: charge.itemId,
        name: charge.name,
        price: charge.price,
        quantity: charge.quantity,
        subtotal: charge.subtotal,
        timeAdded: new Date(
          charge.createdAt
        ),
        orderedAt: charge.orderedAt,
      })) ?? [];
  const selectedPreviousBillTotal =
    selectedPanelAccount?.grandTotal ?? 0;
  const selectedNewBillTotal =
    selectedPreviousBillTotal + selectedCartTotal;
  const selectedBillPrimaryLabel =
    selectedPanelAccount
      ? getBillPrimaryLabel(selectedPanelAccount)
      : "";
  const selectedBillCustomerLine =
    selectedPanelAccount
      ? [
          getBillCustomerLabel(
            selectedPanelAccount
          ),
          selectedBillAccount
            ? getBillTableLabel(
                selectedBillAccount
              )
            : "Waiting for table",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const selectedCustomerName =
    selectedTarget?.type === "runningTable"
      ? selectedTarget.playerName
      : selectedTarget?.type === "waitingCustomer"
        ? getWaitingCustomerOrder(
            selectedTarget.customerId
          )?.name ??
          openCustomerBills.find(
            (customer) =>
              customer.id ===
              selectedTarget.customerAccountId
          )?.customerName ??
          ""
        : selectedTarget?.type === "openBill"
          ? selectedTarget.customerName ?? ""
        : "";

  const selectedCustomerMeta =
    selectedTarget?.type === "runningTable"
      ? `Table ${selectedTarget.tableId}`
      : selectedBillAccount
        ? `${selectedBillAccount.customerToken}${getBillTableLabel(selectedBillAccount) ? ` · ${getBillTableLabel(selectedBillAccount)}` : ""}`
        : "Waiting Customer";

  void selectedCustomerMeta;

  const selectedTable =
    selectedTarget?.type === "runningTable"
      ? tables.find(
          (table) =>
            table.id ===
            selectedTarget.tableId
        )
      : undefined;

  const selectedWaitingSavedOrder =
    selectedTarget?.type === "waitingCustomer"
      ? savedOrders.find(
          (order) =>
            order.customerType ===
              "waiting_customer" &&
            order.customerName ===
              selectedCustomerName &&
            order.paymentStatus === "saved"
        )
      : undefined;

  const handleIncrease = (
    menuItemId: string
  ) => {
    if (!selectedTarget) return;

    if (selectedTarget.type === "runningTable") {
      increasePlayerItem(
        selectedTarget.tableId,
        selectedTarget.playerName,
        menuItemId,
        selectedTarget.customerId
      );
      return;
    }

    if (selectedTarget.type === "openBill") {
      const item = useCafeStore
        .getState()
        .menu.find(
          (menuItem) =>
            menuItem.id === menuItemId
        );

      if (!item) return;

      setOpenBillCarts((state) => {
        const cart =
          state[
            selectedTarget.customerAccountId
          ] ?? [];
        const existing = cart.find(
          (cartItem) =>
            cartItem.menuItemId === menuItemId
        );
        const nextCart = existing
          ? cart.map((cartItem) =>
              cartItem.menuItemId === menuItemId
                ? {
                    ...cartItem,
                    quantity:
                      cartItem.quantity + 1,
                    subtotal:
                      cartItem.price *
                      (cartItem.quantity + 1),
                  }
                : cartItem
            )
          : [
              ...cart,
              {
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                subtotal: item.price,
                timeAdded: new Date(),
                orderedAt:
                  new Date().toISOString(),
              },
            ];

        return {
          ...state,
          [selectedTarget.customerAccountId]:
            nextCart,
        };
      });
      return;
    }

    increaseWaitingItem(
      selectedTarget.customerId,
      menuItemId
    );
  };

  const handleDecrease = (
    menuItemId: string
  ) => {
    if (!selectedTarget) return;

    if (selectedTarget.type === "runningTable") {
      decreasePlayerItem(
        selectedTarget.tableId,
        selectedTarget.playerName,
        menuItemId,
        selectedTarget.customerId
      );
      return;
    }

    if (selectedTarget.type === "openBill") {
      setOpenBillCarts((state) => {
        const cart =
          state[
            selectedTarget.customerAccountId
          ] ?? [];
        const nextCart = cart
          .map((cartItem) =>
            cartItem.menuItemId === menuItemId
              ? {
                  ...cartItem,
                  quantity:
                    cartItem.quantity - 1,
                  subtotal:
                    cartItem.price *
                    (cartItem.quantity - 1),
                }
              : cartItem
          )
          .filter(
            (cartItem) =>
              cartItem.quantity > 0
          );

        return {
          ...state,
          [selectedTarget.customerAccountId]:
            nextCart,
        };
      });
      return;
    }

    decreaseWaitingItem(
      selectedTarget.customerId,
      menuItemId
    );
  };

  const handleAddMenuItem = (
    menuItemId: string
  ) => {
    if (!selectedTarget) return;

    const item = useCafeStore
      .getState()
      .menu.find(
        (menuItem) =>
          menuItem.id === menuItemId
      );

    if (!item) return;

    if (
      selectedTarget.type === "runningTable"
    ) {
      addItemToPlayer(
        selectedTarget.tableId,
        selectedTarget.sessionId,
        selectedTarget.playerName,
        item,
        selectedTarget.customerId
      );
      return;
    }

    if (
      selectedTarget.type ===
      "waitingCustomer"
    ) {
      addItemToWaitingCustomer(
        selectedTarget.customerId,
        item
      );
      return;
    }

    setOpenBillCarts((state) => {
      const cart =
        state[
          selectedTarget.customerAccountId
        ] ?? [];
      const existing = cart.find(
        (cartItem) =>
          cartItem.menuItemId === menuItemId
      );
      const nextCart = existing
        ? cart.map((cartItem) =>
            cartItem.menuItemId === menuItemId
              ? {
                  ...cartItem,
                  quantity:
                    cartItem.quantity + 1,
                  subtotal:
                    cartItem.price *
                    (cartItem.quantity + 1),
                }
              : cartItem
          )
        : [
            ...cart,
            {
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity: 1,
              subtotal: item.price,
              timeAdded: new Date(),
              orderedAt:
                new Date().toISOString(),
            },
          ];

      return {
        ...state,
        [selectedTarget.customerAccountId]:
          nextCart,
      };
    });
  };

  const createCustomerBill = (input: string) => {
    const value = input.trim();
    const isNamedCustomer =
      !!value && !value.includes(" ");

    const account =
      useCustomerAccountStore
        .getState()
        .createCustomerAccount({
          customerName: isNamedCustomer
            ? value
            : "Walk-in Customer",
          customerNote:
            value && !isNamedCustomer
              ? value
              : undefined,
        });

    useCafeStore.setState((state) => ({
      waitingCustomers: [
        ...state.waitingCustomers.filter(
          (customer) =>
            customer.id !== account.id
        ),
        {
          id: account.id,
          name: account.customerName,
          orderItems: [],
          totalAmount: 0,
        },
      ],
    }));

    setSelectedTarget({
      type: "waitingCustomer",
      customerId: account.id,
      customerAccountId: account.id,
      billNo: getBillPrimaryLabel(account),
      customerName: account.customerName,
    });
    setOrderMessage(
      `New walk-in bill created: ${getBillPrimaryLabel(account)}`
    );
    setOrderError("");
    setNewCustomerText("");
    setNewCustomerDialogOpen(false);
  };

  const handleAddCustomerBill = () => {
    setNewCustomerText("");
    setNewCustomerDialogOpen(true);
  };

  const handleSelectOpenCustomerBill = (
    customerId: string,
    customerName: string
  ) => {
    const account =
      openCustomerBills.find(
        (customer) =>
          customer.id === customerId
      );

    setSelectedTarget({
      type: "openBill",
      customerAccountId: customerId,
      customerName,
      billNo: account
        ? getBillPrimaryLabel(account)
        : undefined,
    });
  };

  useEffect(() => {
    const customerBillId = searchParams.get(
      "customerBillId"
    );

    if (!customerBillId) return;

    const customer = openCustomerBills.find(
      (account) => account.id === customerBillId
    );

    if (!customer) return;

    handleSelectOpenCustomerBill(
      customer.id,
      customer.customerName
    );
  }, [searchParams, openCustomerBills]);

  useEffect(() => {
    const tableId = Number(
      searchParams.get("tableId")
    );
    const sessionId =
      searchParams.get("sessionId");

    if (!tableId || !sessionId) return;

    const urlTargetKey = `${tableId}-${sessionId}`;
    const sameRunningTarget =
      selectedTarget?.type === "runningTable" &&
      selectedTarget.tableId === tableId &&
      selectedTarget.sessionId === sessionId;

    if (
      sameRunningTarget &&
      previousUrlTableTargetKey.current === urlTargetKey
    ) {
      return;
    }

    const table = tables.find(
      (item) =>
        item.id === tableId &&
        item.session?.id === sessionId
    );

    if (!table?.session) return;
    previousUrlTableTargetKey.current =
      urlTargetKey;

    const firstPlayer =
      getSessionPlayerEntries(table.session)[0];
    const playerName =
      firstPlayer?.name ?? "Walk-in Customer";

    setExpandedTable(table.id);
    setSelectedTarget({
      type: "runningTable",
      tableId: table.id,
      sessionId: table.session.id,
      playerName,
      customerId: firstPlayer?.customerId,
    });
  }, [searchParams, selectedTarget, tables]);

  const isCustomerBillCode = (value?: string) =>
    /^CUST-\d+$/i.test(value?.trim() ?? "");

  const getRunningPlayerLabel = (
    table: (typeof tables)[number],
    playerName: string,
    playerCustomerId?: string
  ) => {
    const playerAccount =
      customerAccounts.find(
        (account) =>
          account.id === playerCustomerId
      );
    const accountName =
      playerAccount?.customerName?.trim();
    const accountNote =
      playerAccount?.customerNote?.trim();
    const cleanPlayerName =
      playerName.trim();

    if (
      accountName &&
      !isWalkInName(accountName) &&
      !isCustomerBillCode(accountName)
    ) {
      return accountName;
    }

    if (accountNote) {
      return accountNote;
    }

    if (
      cleanPlayerName &&
      !isWalkInName(cleanPlayerName) &&
      !isCustomerBillCode(cleanPlayerName)
    ) {
      return cleanPlayerName;
    }

    return playerAccount
      ? getBillPrimaryLabel(playerAccount)
      : getWalkInDisplayName({
          name: playerName,
          tableId: table.id,
          tableName: table.name,
          tableType: table.type,
          time: table.session!.startTime,
        });
  };

  const handleSaveOrder = ({
    returnToDashboard = false,
  }: {
    returnToDashboard?: boolean;
  } = {}) => {
    setOrderMessage("");
    setOrderError("");
    setLastSavedTotal(null);

    if (!selectedTarget) {
      setOrderError(
        "Please select a customer first."
      );
      return;
    }

    const currentItems =
      selectedTarget.type === "runningTable"
        ? selectedOrder?.orderItems ?? []
        : selectedOrder?.orderItems ?? [];

    if (currentItems.length === 0) {
      setOrderError(
        "Please add at least one item."
      );
      return;
    }

    try {
      if (
        selectedTarget.type ===
          "waitingCustomer" &&
        !selectedTarget.customerAccountId
      ) {
        const account =
          useCustomerAccountStore
            .getState()
            .createCustomerAccount({
              customerName:
                selectedCustomerName ||
                "Walk-in Customer",
            });
        const now = new Date().toISOString();

        useCustomerAccountStore
          .getState()
          .replaceCafeChargesForOrder({
            customerId: account.id,
            customerName: account.customerName,
            customerNote: account.customerNote,
            sourceOrderId: `CAFE-BILL-${account.id}-${Date.now()}`,
            charges: currentItems.map((item) => ({
              itemId: item.menuItemId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
              orderedAt:
                item.orderedAt ?? now,
            })),
          });

        useCafeStore.setState((state) => ({
          waitingCustomers: [
            ...state.waitingCustomers.filter(
              (customer) =>
                customer.id !==
                selectedTarget.customerId
            ),
            {
              id: account.id,
              name: account.customerName,
              orderItems: [],
              totalAmount: 0,
            },
          ],
        }));

        setSelectedTarget({
          type: "waitingCustomer",
          customerId: account.id,
          customerAccountId: account.id,
          billNo: getBillPrimaryLabel(account),
          customerName: account.customerName,
        });
        setOrderMessage(
          `Items added to ${getBillPrimaryLabel(account)}`
        );
        setLastSavedTotal(null);
        if (returnToDashboard) {
          navigate("/operator");
        }
        return;
      }

      if (
        (selectedTarget.type === "openBill" ||
          (selectedTarget.type ===
            "waitingCustomer" &&
            selectedTarget.customerAccountId))
      ) {
        const customerAccountId =
          selectedTarget.type === "openBill"
            ? selectedTarget.customerAccountId
            : selectedTarget.customerAccountId;

        if (!customerAccountId) {
          setOrderError(
            "Selected bill could not be found."
          );
          return;
        }

        const account =
          useCustomerAccountStore
            .getState()
            .getCustomerById(
              customerAccountId
            );
        const now = new Date().toISOString();

        if (!account) {
          setOrderError(
            "Selected bill could not be found."
          );
          return;
        }

        useCustomerAccountStore
          .getState()
          .replaceCafeChargesForOrder({
            customerId: account.id,
            customerName: account.customerName,
            customerNote: account.customerNote,
            sourceOrderId: `CAFE-BILL-${account.id}-${Date.now()}`,
            charges: currentItems.map((item) => ({
              itemId: item.menuItemId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
              tableName: account.lastTableName,
              orderedAt:
                item.orderedAt ?? now,
            })),
          });

        if (
          selectedTarget.type ===
          "openBill"
        ) {
          setOpenBillCarts((state) => ({
            ...state,
            [selectedTarget.customerAccountId]:
              [],
          }));
        } else {
          useCafeStore.setState((state) => ({
            waitingCustomers:
              state.waitingCustomers.map(
                (customer) =>
                  customer.id ===
                  selectedTarget.customerId
                    ? {
                        ...customer,
                        orderItems: [],
                        totalAmount: 0,
                      }
                    : customer
              ),
          }));
        }

        setOrderMessage(
          `Items added to ${getBillPrimaryLabel(account)}`
        );
        setLastSavedTotal(null);
        if (returnToDashboard) {
          navigate("/operator");
        }
        return;
      }

      const savedOrder = saveOrder({
        tableId:
          selectedTarget.type === "runningTable"
            ? selectedTarget.tableId
            : undefined,
        tableName: selectedTable?.name,
        sessionId:
          selectedTarget.type === "runningTable"
            ? selectedTarget.sessionId
            : undefined,
        customerName:
          selectedCustomerName,
        customerAccountId:
          selectedTarget.type === "runningTable"
            ? selectedTarget.customerId
            : selectedTarget.type === "waitingCustomer"
              ? selectedTarget.customerAccountId
              : undefined,
        orderItems: currentItems,
        customerType:
          selectedTarget.type ===
          "waitingCustomer"
            ? "waiting_customer"
            : "table_player",
      });
      useCustomerAccountStore
        .getState()
        .replaceCafeChargesForOrder({
          customerId:
            selectedTarget.type === "runningTable"
              ? selectedTarget.customerId
              : selectedTarget.customerAccountId
                ? selectedTarget.customerAccountId
              : undefined,
          customerName:
            savedOrder.customerName,
          sourceOrderId: savedOrder.id,
          charges:
            savedOrder.orderItems.map(
              (item) => ({
                itemId: item.menuItemId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal,
                tableId: savedOrder.tableId,
                tableName:
                  savedOrder.tableName,
                sessionId:
                  savedOrder.sessionId,
                orderedAt:
                  item.orderedAt ??
                  new Date().toISOString(),
              })
            ),
        });

      if (selectedTarget.type === "runningTable") {
        updateSessionCafe({
          tableId: selectedTarget.tableId,
          cafeOrders:
            useCafeStore
              .getState()
              .getTableOrderItems(
                selectedTarget.tableId
              ),
        });
      }

      setOrderMessage(
        savedOrder.tableName
          ? `Order saved for ${savedOrder.tableName}. Cafe bill is Rs. ${savedOrder.totalAmount}.`
          : `Order saved for ${savedOrder.customerName}`
      );
      setLastSavedTotal(
        savedOrder.totalAmount
      );
      if (returnToDashboard) {
        navigate("/operator");
      }
    } catch (error) {
      console.error(error);
      setOrderError(
        "Order could not be saved. Please try again."
      );
    }
  };

  const openWaitingPaymentDialog = () => {
    setOrderMessage("");
    setOrderError("");

    if (!selectedWaitingSavedOrder) {
      setOrderError(
        "Please save the waiting customer order first."
      );
      return;
    }

    if (!activeBusinessDay) {
      setOrderError(
        "Please start the day before receiving payment."
      );
      return;
    }

    setPaymentMethod("");
    setPaymentDialogOpen(true);
  };

  const handleReceiveWaitingPayment = () => {
    setOrderMessage("");
    setOrderError("");

    if (!selectedWaitingSavedOrder) {
      setOrderError(
        "Please save the waiting customer order first."
      );
      return;
    }

    if (!paymentMethod) {
      setOrderError(
        "Please select payment method."
      );
      return;
    }

    const activeDay = activeBusinessDay;

    if (!activeDay) {
      setOrderError(
        "Please start the day before receiving payment."
      );
      return;
    }

    const paidOrder =
      receiveWaitingCustomerPayment(
        selectedWaitingSavedOrder.id,
        paymentMethod
      );

    if (!paidOrder) {
      setOrderError(
        "Payment could not be recorded."
      );
      return;
    }

    const salesStore =
      useSalesStore.getState();
    const invoiceNumber =
      salesStore.getNextInvoiceNumber();
    const staffBillNumber =
      isWalkInName(paidOrder.customerName)
        ? salesStore.getNextWalkInBillNumber("C")
        : undefined;
    const now = new Date().toISOString();

    salesStore.addSale({
      id: `SALE-${invoiceNumber}-CAFE`,
      invoiceNumber,
      staffBillNumber,
      tableId: 0,
      tableName: "-",
      saleType: "cafe_only",
      sessionId: paidOrder.id,
      players: [
        {
          name: paidOrder.customerName,
        },
      ],
      sessionType: "time",
      payerName: paidOrder.customerName,
      startedAt: paidOrder.createdAt,
      endedAt: paidOrder.paidAt ?? now,
      durationMinutes: 0,
      createdAt: paidOrder.paidAt ?? now,
      paidAt: paidOrder.paidAt ?? now,
      tableAmount: 0,
      cafeAmount: paidOrder.totalAmount,
      subtotal: paidOrder.totalAmount,
      discount: 0,
      grandTotal: paidOrder.totalAmount,
      paymentMethod,
      paymentStatus: "paid",
      activeBusinessDayId:
        activeDay.id,
      orderedItems:
        paidOrder.orderItems,
      playerBreakdown: [
        {
          playerName:
            paidOrder.customerName,
          tableAmountShare: 0,
          cafeAmount:
            paidOrder.totalAmount,
          totalAmount:
            paidOrder.totalAmount,
          cafeItems:
            paidOrder.orderItems,
        },
      ],
    });

    setOrderMessage(
      `Payment received for ${paidOrder.customerName}.`
    );
    setSelectedTarget(null);
    setLastSavedTotal(null);
    setPaymentDialogOpen(false);
    setPaymentMethod("");
  };

  const handleAttachWaitingOrder = () => {
    setOrderMessage("");
    setOrderError("");

    if (!selectedAttachAccount) {
      setOrderError(
        "Please save the waiting customer order first."
      );
      return;
    }

    if (
      selectedAttachAccount.paymentStatus ===
      "paid"
    ) {
      setOrderError(
        "This bill is already paid."
      );
      return;
    }

    if (attachableTables.length === 0) {
      setOrderError(
        "No available tables."
      );
      return;
    }

    setAttachTableId(
      String(attachableTables[0].id)
    );
    setAttachSessionType("single");
    setAttachDialogOpen(true);
  };

  const handleConfirmAttachToTable = () => {
    setOrderMessage("");
    setOrderError("");

    if (!selectedAttachAccount) return;

    const selectedTableId = Number(attachTableId);
    const table = useTableStore
      .getState()
      .tables.find(
        (item) => item.id === selectedTableId
      );

    const selectedTableOption =
      attachableTables.find(
      (item) =>
        String(item.id) === attachTableId
    );

    if (!selectedTableOption || !table) {
      setOrderError(
        "Please choose a table."
      );
      return;
    }

    if (
      table.status !== "available" ||
      table.session
    ) {
      setOrderError(
        `Cannot attach ${getBillPrimaryLabel(selectedAttachAccount)} to ${table.name}. ${getAttachBlockedMessage(table)}`
      );
      return;
    }

    startSession({
      tableId: table.id,
      sessionType:
        table.type === "private-room"
          ? "private"
          : attachSessionType,
      player1:
        selectedAttachAccount.customerName,
      player1CustomerId:
        selectedAttachAccount.id,
      startTime: new Date(),
    });

    const attachedSession =
      useTableStore
        .getState()
        .tables.find(
          (item) => item.id === table.id
        )?.session;

    if (
      attachedSession &&
      selectedAttachAccount.cafeCharges.length > 0
    ) {
      updateSessionCafe({
        tableId: table.id,
        cafeOrders: selectedAttachAccount.cafeCharges.map(
          (charge) => ({
            menuItemId: charge.itemId,
            name: charge.name,
            price: charge.price,
            quantity: charge.quantity,
            subtotal: charge.subtotal,
            timeAdded: new Date(charge.orderedAt),
            tableId: table.id,
            sessionId: attachedSession.id,
            customerName:
              selectedAttachAccount.customerName,
            playerName:
              selectedAttachAccount.customerName,
            orderedAt: charge.orderedAt,
          })
        ),
      });
    }

    useCafeStore.setState((state) => ({
      waitingCustomers:
        state.waitingCustomers.filter(
          (customer) =>
            customer.id !==
            selectedAttachAccount.id
        ),
    }));
    closeCustomerAccount(
      selectedAttachAccount.id
    );

    setSelectedTarget({
      type: "runningTable",
      tableId: table.id,
      sessionId: attachedSession?.id ?? "",
      playerName:
        selectedAttachAccount.customerName,
      customerId: selectedAttachAccount.id,
    });
    setExpandedTable(table.id);
    setAttachDialogOpen(false);

    setOrderMessage(
      `${getBillPrimaryLabel(selectedAttachAccount)} attached to ${table.name}.`
    );
  };

  return (
    <main className="h-screen bg-slate-100 p-4">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <Dialog
          open={newCustomerDialogOpen}
          onOpenChange={setNewCustomerDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                New Customer / Walk-in Bill
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <Input
                autoFocus
                placeholder="Customer name or note"
                value={newCustomerText}
                onChange={(event) =>
                  setNewCustomerText(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createCustomerBill(
                      newCustomerText
                    );
                  }
                }}
              />
              <p className="text-sm text-slate-500">
                Leave blank for a quick walk-in bill.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setNewCustomerDialogOpen(false)
                  }
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    createCustomerBill(
                      newCustomerText
                    )
                  }
                >
                  Create Bill
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <header className="flex items-center justify-between border-b px-8 py-5">
          <div>
            <h1 className="text-3xl font-bold">
              Cafe POS
            </h1>
            <p className="text-gray-500">
              Snooker Arena Management System
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-semibold">
                {new Date().toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleTimeString()}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() =>
                navigate("/operator")
              }
            >
              Back to Dashboard
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden">
          <aside className="col-span-3 flex min-h-0 flex-col border-r bg-slate-50">
            <div className="border-b p-5">
              <h2 className="text-2xl font-bold">
                Customers
              </h2>

              <Input
                className="mt-4"
                placeholder="Search..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-sm font-bold uppercase text-gray-500">
                Running Tables
              </p>

              <div className="space-y-3">
                {runningTables.map((table) => (
                  <div
                    key={table.id}
                    className="rounded-xl border bg-white"
                  >
                    {(() => {
                      const sessionPlayers =
                        getSessionPlayerEntries(
                          table.session!
                        );
                      const getPlayerLabel = (
                        player: (typeof sessionPlayers)[number]
                      ) =>
                        getRunningPlayerLabel(
                          table,
                          player.name,
                          player.customerId
                        );

                      return (
                        <>
                    <button
                      className="flex w-full items-center justify-between p-4 text-left"
                      onClick={() =>
                        setExpandedTable(
                          expandedTable === table.id
                            ? null
                            : table.id
                        )
                      }
                    >
                      <div>
                        <p className="font-bold">
                          {table.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Running
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">
                          {sessionPlayers
                            .map(getPlayerLabel)
                            .join(" vs ")}
                        </p>
                      </div>

                      <span className="text-sm text-gray-500">
                        {expandedTable === table.id
                          ? "Open"
                          : "Select"}
                      </span>
                    </button>

                    {expandedTable === table.id && (
                      <div className="space-y-2 border-t p-3">
                        {sessionPlayers.map((player) => {
                          return (
                            <Button
                              key={`${player.slot}-${player.customerId ?? player.name}`}
                              variant={
                                selectedTarget?.type ===
                                  "runningTable" &&
                                selectedTarget.tableId ===
                                  table.id &&
                                (player.customerId
                                  ? selectedTarget.customerId === player.customerId
                                  : selectedTarget.playerName === player.name)
                                  ? "default"
                                  : "secondary"
                              }
                              className="w-full justify-start"
                              onClick={() =>
                                setSelectedTarget({
                                  type: "runningTable",
                                  tableId: table.id,
                                  sessionId:
                                    table.session!.id,
                                  playerName: player.name,
                                  customerId:
                                    player.customerId,
                                })
                              }
                            >
                              {getPlayerLabel(player)}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>

              <p className="mb-3 mt-8 text-sm font-bold uppercase text-gray-500">
                Waiting for Table
              </p>

              <div className="space-y-2">
                {filteredWaiting.map((customer) => {
                  const labels =
                    getWaitingCustomerLabels(
                      customer
                    );
                  const account =
                    getWaitingCustomerAccount(
                      customer.id
                    );
                  const primaryLabel = account
                    ? getBillPrimaryLabel(account)
                    : labels.primary;
                  const secondaryLabel = account
                    ? [
                        getBillCustomerLabel(
                          account
                        ),
                        getBillTableLabel(
                          account
                        ),
                        primaryLabel !==
                        account.customerToken
                          ? `Account: ${account.customerToken}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : labels.secondary;
                  const selected =
                    selectedTarget?.type ===
                      "waitingCustomer" &&
                    selectedTarget.customerId ===
                      customer.id;

                  return (
                    <div
                      key={customer.id}
                      className="flex items-stretch gap-2"
                    >
                      <Button
                        variant={
                          selected
                            ? "default"
                            : "secondary"
                        }
                        className={`h-auto min-w-0 flex-1 justify-start py-2 text-left ${
                          selected
                            ? "bg-slate-950 text-white hover:bg-slate-900"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedTarget({
                            type: "waitingCustomer",
                            customerId:
                              customer.id,
                            customerAccountId:
                              account?.id,
                            billNo: account
                              ? getBillPrimaryLabel(
                                  account
                                )
                              : undefined,
                            customerName:
                              account?.customerName ??
                              customer.name,
                          })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {primaryLabel}
                          </span>
                          {secondaryLabel && (
                            <span className="block truncate text-xs opacity-75">
                              {secondaryLabel}
                            </span>
                          )}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          handleEditWaitingCustomer(
                            customer.id
                          )
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() =>
                          handleDeleteWaitingCustomer(
                            customer.id
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={
                    handleAddCustomerBill
                  }
                >
                  New Customer / Walk-in Bill
                </Button>
              </div>

              <div className="mb-3 mt-8 flex items-center justify-between">
                <p className="text-sm font-bold uppercase text-gray-500">
                  Unpaid / Open Bills
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setOpenBillsExpanded(
                      (expanded) => !expanded
                    )
                  }
                >
                  {openBillsExpanded
                    ? "Hide"
                    : "Show"}{" "}
                  ({filteredOpenCustomerBills.length})
                </Button>
              </div>

              {openBillsExpanded && (
                <div className="space-y-2">
                  {filteredOpenCustomerBills.map(
                    (customer) => (
                      <Button
                        key={customer.id}
                        data-selected={
                          selectedTarget?.type ===
                            "openBill" &&
                          selectedTarget.customerAccountId ===
                            customer.id
                        }
                        variant={
                          selectedTarget?.type ===
                            "openBill" &&
                          selectedTarget.customerAccountId ===
                            customer.id
                            ? "default"
                            : "secondary"
                        }
                        className={`h-auto w-full justify-between gap-3 py-3 text-left ${
                          selectedTarget?.type ===
                            "openBill" &&
                          selectedTarget.customerAccountId ===
                            customer.id
                            ? "bg-slate-950 text-white hover:bg-slate-900"
                            : ""
                        }`}
                        onClick={() =>
                          handleSelectOpenCustomerBill(
                            customer.id,
                            customer.customerName
                          )
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {getBillPrimaryLabel(
                              customer
                            )}
                          </span>
                          <span className="block truncate text-xs opacity-75">
                            {getBillSecondaryLabel(
                              customer
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold">
                          Rs. {customer.grandTotal}
                        </span>
                      </Button>
                    )
                  )}

                  {filteredOpenCustomerBills.length ===
                    0 && (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-gray-500">
                      No open bills.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>

          <section className="col-span-6 min-h-0 border-r p-6">
            <MenuPanel
              disabled={!selectedTarget}
              selectedTarget={selectedTarget}
              onAddItem={handleAddMenuItem}
            />
          </section>

          <aside className="col-span-3 min-h-0 bg-slate-50 p-6">
            {!selectedTarget ? (
              <div className="flex h-full flex-col">
                {orderMessage && (
                  <p className="mb-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {orderMessage}
                  </p>
                )}

                {orderError && (
                  <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {orderError}
                  </p>
                )}

                <h2 className="text-2xl font-bold">
                  Current Order
                </h2>

                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl">
                      Cart
                    </div>
                    <h3 className="mt-5 text-xl font-bold">
                      No Customer Selected
                    </h3>
                    <p className="mt-2 text-gray-500">
                      Select a player or waiting
                      customer to begin taking an
                      order.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3">
                {orderMessage && (
                  <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {orderMessage}
                  </p>
                )}

                {orderError && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {orderError}
                  </p>
                )}

                {selectedPanelAccount && (
                  <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      {selectedBillAccount
                        ? "Current Bill"
                        : "Current Bill / Waiting Customer"}
                    </p>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {selectedBillPrimaryLabel}
                    </h2>
                    {selectedBillCustomerLine && (
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedBillCustomerLine}
                      </p>
                    )}
                    {selectedBillPrimaryLabel !==
                      selectedPanelAccount.customerToken && (
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Account:{" "}
                        {
                          selectedPanelAccount.customerToken
                        }
                      </p>
                    )}
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">
                          Previous Bill
                        </span>
                        <strong>
                          Rs.{" "}
                          {
                            selectedPreviousBillTotal
                          }
                        </strong>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">
                          Current Cart
                        </span>
                        <strong>
                          Rs. {selectedCartTotal}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-3 border-t pt-2 text-base">
                        <span className="font-bold">
                          New Total
                        </span>
                        <strong className="text-emerald-700">
                          Rs. {selectedNewBillTotal}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <OrderCart
                  customerName="Cart"
                  customerMeta={undefined}
                  items={
                    selectedOrder?.orderItems ?? []
                  }
                  savedItems={
                    selectedSavedCafeItems
                  }
                  onIncrease={handleIncrease}
                  onDecrease={handleDecrease}
                  onSave={() => handleSaveOrder()}
                  onSaveAndReturn={() =>
                    handleSaveOrder({
                      returnToDashboard: true,
                    })
                  }
                  saveDisabled={
                    !selectedTarget
                  }
                  saveLabel={
                    selectedBillAccount
                      ? "Save"
                      : lastSavedTotal ===
                    (selectedOrder?.totalAmount ??
                      0)
                      ? "Saved"
                      : "Save"
                  }
                  saveAndReturnLabel="Save & Return"
                />

                {!attachDialogOpen &&
                  selectedAttachAccount &&
                  selectedAttachAccount.grandTotal >
                    0 && (
                    <Button
                      variant="outline"
                      className="w-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                      onClick={
                        handleAttachWaitingOrder
                      }
                      disabled={
                        selectedAttachAccount.paymentStatus ===
                        "paid"
                      }
                    >
                      Attach to Table
                    </Button>
                  )}

                {selectedTarget.type ===
                  "waitingCustomer" &&
                  !selectedBillAccount &&
                  selectedWaitingAccount &&
                  selectedWaitingAccount.grandTotal >
                    0 && (
                    <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-950">
                          Saved waiting order
                        </p>
                        <p className="text-sm text-slate-500">
                          Rs.{" "}
                          {
                            selectedWaitingAccount.grandTotal
                          }{" "}
                          for{" "}
                          {
                            getBillPrimaryLabel(
                              selectedWaitingAccount
                            )
                          }
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Button
                          onClick={
                            openWaitingPaymentDialog
                          }
                          disabled={
                            selectedWaitingAccount.paymentStatus ===
                            "paid"
                          }
                        >
                          Receive Payment
                        </Button>
                      </div>
                    </div>
                  )}

                {paymentDialogOpen &&
                  selectedWaitingSavedOrder && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                      <div className="mb-3">
                        <p className="font-bold text-slate-950">
                          Receive Payment
                        </p>
                        <p className="text-sm text-slate-500">
                          {selectedWaitingSavedOrder.customerName} - Rs.{" "}
                          {selectedWaitingSavedOrder.totalAmount}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Payment Method
                        </label>
                        <select
                          className="mt-1 w-full rounded-md border bg-white p-2"
                          value={paymentMethod}
                          onChange={(event) =>
                            setPaymentMethod(
                              event.target.value as
                                | PaymentMethod
                                | ""
                            )
                          }
                        >
                          <option value="">
                            Select payment method
                          </option>
                          <option value="cash">
                            Cash
                          </option>
                          <option value="card">
                            Card
                          </option>
                          <option value="jazzcash">
                            JazzCash
                          </option>
                          <option value="easypaisa">
                            Easypaisa
                          </option>
                        </select>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPaymentDialogOpen(false);
                            setPaymentMethod("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={
                            handleReceiveWaitingPayment
                          }
                        >
                          Confirm Payment
                        </Button>
                      </div>
                    </div>
                  )}

                {attachDialogOpen &&
                  selectedAttachAccount && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                      <div className="mb-3">
                        <p className="font-bold text-slate-950">
                          Attach to Table
                        </p>
                        <p className="text-sm text-slate-500">
                          {getBillPrimaryLabel(
                            selectedAttachAccount
                          )}{" "}
                          ·{" "}
                          {getBillCustomerLabel(
                            selectedAttachAccount
                          )}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          Existing Cafe Bill: Rs.{" "}
                          {
                            selectedAttachAccount.grandTotal
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Choose Table
                          <select
                            className="rounded-md border bg-white p-2"
                            value={attachTableId}
                            onChange={(event) => {
                              const table =
                                attachableTables.find(
                                  (item) =>
                                    String(item.id) ===
                                    event.target.value
                                );
                              setAttachTableId(
                                event.target.value
                              );
                              if (
                                table?.type ===
                                "private-room"
                              ) {
                                setAttachSessionType(
                                  "private"
                                );
                              } else if (
                                attachSessionType ===
                                "private"
                              ) {
                                setAttachSessionType(
                                  "single"
                                );
                              }
                            }}
                          >
                            {attachableTables.map(
                              (table) => (
                                <option
                                  key={table.id}
                                  value={table.id}
                                >
                                  {table.name} · {table.session?.player1 ?? "Available"}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Current Session
                          <select
                            className="rounded-md border bg-white p-2"
                            value={attachSessionType}
                            onChange={(event) =>
                              setAttachSessionType(
                                event.target
                                  .value as SessionType
                              )
                            }
                            disabled={
                              attachableTables.find(
                                (table) =>
                                  String(table.id) ===
                                  attachTableId
                              )?.type ===
                              "private-room"
                            }
                          >
                            <option value="single">
                              Single Game - Rs. 300
                            </option>
                            <option value="double">
                              Double Game - Rs. 600
                            </option>
                            <option value="time">
                              Table Booking - Rs. 20/min
                            </option>
                            <option value="private">
                              Private Room - Rs. 25/min
                            </option>
                          </select>
                        </label>

                        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                          Bill will attach to this table. Keep same bill.
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setAttachDialogOpen(false)
                          }
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={
                            handleConfirmAttachToTable
                          }
                        >
                          Attach to Table
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default CafePage;
