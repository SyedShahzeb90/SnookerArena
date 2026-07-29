import {
  Coffee,
  CalendarClock,
  LayoutGrid,
  Menu,
  Moon,
  Package,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Sun,
  Trophy,
  WalletCards,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/features/theme/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import DashboardHeader from "./DashboardHeader";
import {
  isActionableCustomerBill,
  useCustomerAccountStore,
} from "@/features/customers/store/customerAccountStore";
import { useTableStore } from "@/store/tableStore";
import {
  getBillPrimaryLabel,
  getBillTableLabel,
} from "@/features/customers/utils/billDisplay";
import {
  selectOutstandingCreditCount,
  useCreditLedgerStore,
} from "@/features/credit-ledger/store/creditLedgerStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import type { AppPermission } from "@/features/admin-mode/permissions";
import AdminModeDialog from "@/features/admin-mode/AdminModeDialog";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";
import {
  INTERFACE_SCALE_OPTIONS,
  type InterfaceScale,
} from "@/features/settings/interfaceScale";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: "collect-payment" | "credit-ledger" | "outside-purchases";
  permission?: AppPermission;
  allowWithoutPin?: boolean;
  hash?: string;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Daily Work",
    items: [
      {
        label: "Business Day",
        path: "/operator/business-day",
        icon: CalendarClock,
        exact: true,
      },
      {
        label: "Tables & Rooms",
        path: "/operator/tables-rooms",
        icon: LayoutGrid,
        exact: true,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Cafe POS", path: "/operator/cafe", icon: Coffee },
      { label: "Accessories POS", path: "/operator/accessories", icon: Package },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Customer Bills", path: "/operator/customer-bills", icon: ReceiptText },
      { label: "Collect Payment", path: "/operator/billing", icon: CreditCard, badge: "collect-payment" },
      { label: "Credit Ledger", path: "/operator/credit-ledger", icon: WalletCards, exact: true, badge: "credit-ledger" },
      { label: "Customer Outside Purchases", path: "/operator/outside-purchases", icon: ShoppingBag, exact: true, badge: "outside-purchases" },
      { label: "Advance Games", path: "/operator/credit-ledger", hash: "#advance-games", icon: Trophy },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "General Settings",
        path: "/operator/general-settings",
        icon: SlidersHorizontal,
        exact: true,
        permission: "manage_settings",
      },
      { label: "Admin Dashboard", path: "/admin", icon: Settings, exact: true, permission: "view_management_reports" },
    ],
  },
];

const managementPaths = [
  "/admin",
  "/operator/expenses",
  "/operator/table-history",
  "/operator/club-settings",
  "/operator/backup-restore",
];

function SidebarNavigation({ onSelect }: { onSelect?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const customerAccounts = useCustomerAccountStore(
    (state) => state.accounts
  );
  const mergeDuplicateWalkInSessionBills = useCustomerAccountStore(
    (state) => state.mergeDuplicateWalkInSessionBills
  );
  useEffect(() => {
    mergeDuplicateWalkInSessionBills();
  }, [mergeDuplicateWalkInSessionBills]);
  const tables = useTableStore((state) => state.tables);
  const openBillCount = useMemo(() => {
    const runningSessions = tables
      .filter(
        (table) =>
          table.session &&
          (table.status === "running" || table.status === "paused")
      )
      .map((table) => table.session!);

    const visibleBills = customerAccounts.filter((account) => {
      if (!isActionableCustomerBill(account) || account.grandTotal <= 0) {
        return false;
      }

      const accountSessionIds = new Set(
        [
          ...account.gameCharges,
          ...account.cafeCharges,
          ...(account.accessoryCharges ?? []),
        ]
          .map((charge) => charge.sessionId)
          .filter(Boolean)
      );

      return !runningSessions.some((session) =>
        accountSessionIds.has(session.id) ||
        [
          session.player1CustomerId,
          session.player2CustomerId,
          session.player3CustomerId,
          session.player4CustomerId,
        ].includes(account.id)
      );
    });
    const seen = new Set<string>();

    return visibleBills.filter((account) => {
      const key = [
        getBillPrimaryLabel(account),
        getBillTableLabel(account),
        account.customerName.trim().toLowerCase(),
        account.grandTotal,
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).length;
  }, [customerAccounts, tables]);
  const outstandingCreditCount = useCreditLedgerStore(
    selectOutstandingCreditCount
  );
  const pendingOutsidePurchaseCount = useOutsidePurchaseStore(
    (state) => state.purchases.filter(
      (item) => item.status === "pending" || item.status === "partial"
    ).length
  );
  const isAdminMode = useAdminModeStore((state) => state.isAdminMode);
  const hasPin = useClubSettingsStore((state) => Boolean(state.settings.adminPinHash));

  return (
    <nav className="space-y-5 px-3 py-3" aria-label="Operator navigation">
      {navigationGroups.map((group) => {
        const visibleItems = group.items.filter((item) =>
          !item.permission || isAdminMode || (item.allowWithoutPin && !hasPin)
        );
        if (visibleItems.length === 0) return null;

        return <div
          key={group.label}
          className={
            group.label === "Management"
              ? "border-t border-slate-200 pt-4"
              : undefined
          }
        >
          <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {visibleItems.map((item) => {
              const active = item.path === "/admin"
                ? managementPaths.some((path) =>
                    path === "/admin"
                      ? location.pathname.startsWith("/admin")
                      : location.pathname.startsWith(path)
                  )
                : item.path === "/operator/business-day"
                  ? location.pathname === item.path || location.pathname === "/operator/day-history"
                : item.hash
                ? location.pathname === item.path && location.hash === item.hash
                : item.exact
                  ? location.pathname === item.path && !location.hash
                  : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              const count =
                item.badge === "collect-payment"
                  ? openBillCount
                  : item.badge === "credit-ledger"
                    ? outstandingCreditCount
                    : item.badge === "outside-purchases"
                      ? pendingOutsidePurchaseCount
                    : 0;

              return (
                <button
                  key={`${item.path}${item.hash ?? ""}`}
                  type="button"
                  className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium transition-[color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    active
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    navigate(`${item.path}${item.hash ?? ""}`);
                    onSelect?.();
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                        active
                          ? "bg-white/15 text-white"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                      aria-label={`${count} ${
                        item.badge === "collect-payment"
                          ? "bills awaiting payment"
                          : item.badge === "credit-ledger"
                            ? "outstanding credit records"
                            : "customer outside purchases awaiting reimbursement"
                      }`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>;
      })}
    </nav>
  );
}

function SidebarInterfaceScaleControl() {
  const settings = useClubSettingsStore((state) => state.settings);
  const updateSettings = useClubSettingsStore((state) => state.updateSettings);
  const currentIndex = INTERFACE_SCALE_OPTIONS.indexOf(
    settings.interfaceScale as InterfaceScale,
  );
  const safeIndex = currentIndex >= 0
    ? currentIndex
    : INTERFACE_SCALE_OPTIONS.indexOf(100);
  const currentScale = INTERFACE_SCALE_OPTIONS[safeIndex];
  const decreaseDisabled = safeIndex <= 0;
  const increaseDisabled = safeIndex >= INTERFACE_SCALE_OPTIONS.length - 1;
  const setScale = (scale: InterfaceScale) => {
    updateSettings({ ...settings, interfaceScale: scale });
  };

  return (
    <div className="mb-1 rounded-md px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs font-semibold text-slate-600">
          Interface Scale
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Decrease interface scale"
            disabled={decreaseDisabled}
            onClick={() => setScale(INTERFACE_SCALE_OPTIONS[safeIndex - 1])}
          >
            -
          </button>
          <button
            type="button"
            className="h-7 min-w-12 rounded-md border border-slate-200 px-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
            title="Reset to 100%"
            aria-label="Reset interface scale to 100%"
            onClick={() => setScale(100)}
          >
            {currentScale}%
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Increase interface scale"
            disabled={increaseDisabled}
            onClick={() => setScale(INTERFACE_SCALE_OPTIONS[safeIndex + 1])}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ onSelect }: { onSelect?: () => void }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const navigate = useNavigate();
  const isAdminMode = useAdminModeStore((state) => state.isAdminMode);
  const requestAdminMode = useAdminModeStore((state) => state.requestAdminMode);
  const exitAdminMode = useAdminModeStore((state) => state.exitAdminMode);
  const hasPin = useClubSettingsStore((state) => Boolean(state.settings.adminPinHash));
  const activeOperator = useBusinessDayStore(
    (state) => state.getActiveBusinessDay()?.openedBy
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
      <div className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <SidebarNavigation onSelect={onSelect} />
      </div>
      <footer className="relative z-10 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        {activeOperator && (
          <div className="mb-1.5 rounded-md bg-slate-50 px-2.5 py-1.5">
            <p className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
              <UserRound className="h-3.5 w-3.5 shrink-0" /> Active operator
            </p>
            <p className="mt-0.5 truncate pl-5.5 text-sm font-semibold text-slate-900" title={activeOperator}>
              {activeOperator}
            </p>
          </div>
        )}
        {isAdminMode ? (
          <div className="mb-1 flex h-9 items-center justify-between gap-2 rounded-md bg-emerald-50 px-2.5">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Admin Mode
            </span>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => {
                exitAdminMode();
                navigate("/operator");
                onSelect?.();
              }}
            >
              Exit
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="mb-1 h-9 w-full justify-start gap-2.5 px-2.5 text-slate-600"
            onClick={() => {
              if (hasPin) {
                requestAdminMode();
              } else {
                navigate("/operator/club-settings");
              }
              onSelect?.();
            }}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Enter Admin Mode</span>
          </Button>
        )}
        <SidebarInterfaceScaleControl />
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full justify-start gap-2.5 px-2.5 text-slate-600 hover:text-slate-950"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </Button>
      </footer>
    </div>
  );
}

function OperatorShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.hash) return;

    mainContentRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100">
      <DashboardHeader />

      <div className="shrink-0 border-b bg-white px-4 py-2 lg:hidden">
        <Button
          variant="outline"
          className="h-9 gap-2"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
        <aside className="hidden min-h-0 w-[224px] shrink-0 border-r border-slate-200 bg-white lg:block">
          <SidebarContent />
        </aside>

        <div
          ref={mainContentRef}
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <Outlet />
        </div>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 flex h-dvh w-[264px] max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-[264px]">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>Operator Menu</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <SidebarContent onSelect={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
      <AdminModeDialog />
    </div>
  );
}

export default OperatorShell;
