import { Bell, Inbox } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { getRemainingPendingBillTotal } from "@/features/business-day/utils/businessDaySummary";
import { getBusinessDayEnd } from "@/features/business-day/utils/businessDayWindow";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useNotificationStore } from "@/features/notifications/store/notificationStore";
import { useTableStore } from "@/store/tableStore";
import { cn } from "@/lib/utils";

type NotificationSeverity = "info" | "warning" | "critical";

interface AppNotification {
  id: string;
  type:
    | "pending-bills"
    | "low-stock"
    | "out-of-stock"
    | "cash-difference"
    | "open-table-session"
    | "unclosed-business-day";
  title: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  actionUrl: string;
  read: boolean;
  priority: number;
}

const OPEN_TABLE_ALERT_MINUTES = 120;

function money(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

const severityClass: Record<NotificationSeverity, string> = {
  info: "bg-slate-100 text-slate-700",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-rose-50 text-rose-700",
};

export default function NotificationCenterButton() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const pendingBills = useCheckoutStore((state) => state.pendingBills);
  const menu = useCafeStore((state) => state.menu);
  const tables = useTableStore((state) => state.tables);
  const businessDays = useBusinessDayStore((state) => state.days);
  const activeBusinessDay = useBusinessDayStore((state) =>
    state.getActiveBusinessDay()
  );
  const readNotificationIds = useNotificationStore(
    (state) => state.readNotificationIds
  );
  const markNotificationRead = useNotificationStore(
    (state) => state.markNotificationRead
  );
  const markAllNotificationsRead = useNotificationStore(
    (state) => state.markAllNotificationsRead
  );

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const notifications = useMemo<AppNotification[]>(() => {
    const readIds = new Set(readNotificationIds);
    const generated: AppNotification[] = [];

    const activePendingBills = pendingBills.filter(
      (bill) => bill.status !== "cancelled"
    );
    const pendingBillsAmount = activePendingBills.reduce(
      (total, bill) => total + getRemainingPendingBillTotal(bill),
      0
    );

    if (activePendingBills.length > 0) {
      const id = "pending-bills";
      generated.push({
        id,
        type: "pending-bills",
        title: "Pending bills",
        message: `${activePendingBills.length} pending ${
          activePendingBills.length === 1 ? "bill" : "bills"
        } worth ${money(pendingBillsAmount)}`,
        severity: "warning",
        createdAt: activePendingBills
          .map((bill) => bill.createdAt)
          .sort()
          .at(-1) ?? new Date(0).toISOString(),
        actionUrl: "/operator/billing",
        read: readIds.has(id),
        priority: 2,
      });
    }

    menu
      .filter(
        (item) =>
          item.trackStock === true &&
          (item.isAvailable ?? item.available) !== false
      )
      .forEach((item) => {
        const stock = Math.max(0, item.currentStock ?? 0);
        const threshold = Math.max(0, item.lowStockAlertQuantity ?? 0);
        const updatedAt = item.updatedAt ?? item.createdAt ?? new Date(0).toISOString();

        if (stock <= 0) {
          const id = `out-of-stock:${item.id}`;
          generated.push({
            id,
            type: "out-of-stock",
            title: "Out of stock",
            message: `${item.name} is out of stock`,
            severity: "critical",
            createdAt: updatedAt,
            actionUrl: "/admin/menu",
            read: readIds.has(id),
            priority: 3,
          });
          return;
        }

        if (threshold > 0 && stock <= threshold) {
          const id = `low-stock:${item.id}`;
          generated.push({
            id,
            type: "low-stock",
            title: "Low stock",
            message: `${item.name} stock is low: ${stock} remaining`,
            severity: "warning",
            createdAt: updatedAt,
            actionUrl: "/admin/menu",
            read: readIds.has(id),
            priority: 2,
          });
        }
      });

    businessDays
      .filter(
        (day) =>
          day.status === "closed" &&
          typeof day.cashDifference === "number" &&
          day.cashDifference !== 0
      )
      .forEach((day) => {
        const difference = day.cashDifference ?? 0;
        const id = `cash-difference:${day.id}`;
        generated.push({
          id,
          type: "cash-difference",
          title: difference < 0 ? "Cash shortage" : "Cash overage",
          message: `${difference < 0 ? "Cash shortage" : "Cash overage"} of ${money(
            Math.abs(difference)
          )} on ${formatDate(day.startedAt)}`,
          severity: "critical",
          createdAt: day.endedAt ?? day.updatedAt,
          actionUrl: "/admin/day-history",
          read: readIds.has(id),
          priority: 3,
        });
      });

    tables.forEach((table) => {
      const session = table.session;
      if (!session || session.endTime) return;

      const openMinutes = Math.floor(
        (now.getTime() - new Date(session.startTime).getTime()) / 60_000
      );

      if (openMinutes < OPEN_TABLE_ALERT_MINUTES) return;

      const id = `open-table-session:${table.id}:${session.id}`;
      generated.push({
        id,
        type: "open-table-session",
        title: "Open table session",
        message: `${table.name} has been open for ${formatDuration(openMinutes)}`,
        severity: "warning",
        createdAt: new Date(session.startTime).toISOString(),
        actionUrl: "/operator/tables-rooms",
        read: readIds.has(id),
        priority: 2,
      });
    });

    if (activeBusinessDay) {
      const expectedClose = getBusinessDayEnd(activeBusinessDay.startedAt);
      if (now.getTime() >= expectedClose.getTime()) {
        const id = `unclosed-business-day:${activeBusinessDay.id}`;
        generated.push({
          id,
          type: "unclosed-business-day",
          title: "Business day still open",
          message: "Business day is still open",
          severity: "warning",
          createdAt: expectedClose.toISOString(),
          actionUrl: "/operator/business-day",
          read: readIds.has(id),
          priority: 2,
        });
      }
    }

    return generated.sort((first, second) => {
      if (second.priority !== first.priority) return second.priority - first.priority;
      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      );
    });
  }, [activeBusinessDay, businessDays, menu, now, pendingBills, readNotificationIds, tables]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const openNotification = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    setOpen(false);
    navigate(notification.actionUrl);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative h-9 w-9 bg-slate-50 text-slate-600"
        aria-label="Open notification center"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className="motion-menu-in absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-1 pb-2 dark:border-slate-800">
            <div>
              <p className="font-bold text-slate-950">Notifications</p>
              <p className="text-xs text-slate-500">Operational alerts will appear here.</p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                className="mt-0.5 whitespace-nowrap text-xs font-semibold text-slate-600 hover:text-slate-950"
                onClick={() =>
                  markAllNotificationsRead(
                    notifications.map((notification) => notification.id)
                  )
                }
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-7 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">No new notifications</p>
            </div>
          ) : (
            <div className="max-h-[22rem] overflow-y-auto pt-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50",
                    !notification.read && "bg-slate-50"
                  )}
                  onClick={() => openNotification(notification)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        severityClass[notification.severity]
                      )}
                    >
                      {notification.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-600" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
