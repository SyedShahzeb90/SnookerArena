import {
  CircleDollarSign,
  Coffee,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  ReceiptText,
  Settings,
  Sun,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
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

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: "customer-bills" | "credit-ledger" | "outside-purchases";
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Main",
    items: [
      {
        label: "Floor Overview",
        path: "/operator",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Customer Bills", path: "/operator/customer-bills", icon: ReceiptText, badge: "customer-bills" },
      { label: "Credit Ledger", path: "/operator/credit-ledger", icon: WalletCards, badge: "credit-ledger" },
      { label: "Expenses", path: "/operator/expenses", icon: CircleDollarSign, badge: "outside-purchases" },
    ],
  },
  {
    label: "POS",
    items: [
      { label: "Cafe POS", path: "/operator/cafe", icon: Coffee },
      { label: "Accessories POS", path: "/operator/accessories", icon: Package },
    ],
  },
  {
    label: "Reports / Management",
    items: [
      { label: "Table History", path: "/operator/table-history", icon: History },
      { label: "Admin", path: "/admin", icon: Settings },
    ],
  },
];

function SidebarNavigation({ onSelect }: { onSelect?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const customerAccounts = useCustomerAccountStore(
    (state) => state.accounts
  );
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

  return (
    <nav className="space-y-4 p-2.5" aria-label="Operator navigation">
      {navigationGroups.map((group) => (
        <div
          key={group.label}
          className={
            group.label === "Reports / Management"
              ? "border-t border-slate-200 pt-4"
              : undefined
          }
        >
          <p className="mb-1 px-2 text-xs font-semibold uppercase text-slate-400">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              const count =
                item.badge === "customer-bills"
                  ? openBillCount
                  : item.badge === "credit-ledger"
                    ? outstandingCreditCount
                    : item.badge === "outside-purchases"
                      ? pendingOutsidePurchaseCount
                    : 0;

              return (
                <button
                  key={item.path}
                  type="button"
                  className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    navigate(item.path);
                    onSelect?.();
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${
                        active
                          ? "bg-white/15 text-white"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                      aria-label={`${count} ${
                        item.badge === "customer-bills"
                          ? "open customer bills"
                          : item.badge === "credit-ledger"
                            ? "outstanding credit records"
                            : "outside purchases awaiting reimbursement"
                      }`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onSelect }: { onSelect?: () => void }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNavigation onSelect={onSelect} />
      </div>
      <div className="border-t border-slate-200 p-2.5">
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
      </div>
    </div>
  );
}

function OperatorShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader />

      <div className="border-b bg-white px-4 py-2 lg:hidden">
        <Button
          variant="outline"
          className="h-9 gap-2"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </div>

      <div className="flex min-w-0 items-start">
        <aside className="sticky top-0 hidden h-[calc(100vh-89px)] w-[188px] shrink-0 border-r border-slate-200 bg-white lg:block">
          <SidebarContent />
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 flex h-dvh w-[248px] max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-[248px]">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>Operator Menu</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <SidebarContent onSelect={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OperatorShell;
