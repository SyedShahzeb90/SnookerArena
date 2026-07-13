import {
  Clock,
  Coffee,
  CircleDollarSign,
  Package,
  Users,
} from "lucide-react";

import type { Session } from "@/types/session";
import type { Table } from "@/types/table";
import { calculateBill } from "@/features/pricing/utils/calculateBill";
import { calculateGamePrice } from "@/features/pricing/utils/calculateGamePrice";
import { getSessionPlayers } from "@/features/sessions/utils/sessionPlayers";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import type { CustomerAccount } from "@/features/customers/types/customerAccount";

interface Props {
  session: Session;
  tableId?: number;
  tableType: Table["type"];
  now: Date;
  onCafeBillClick?: () => void;
  onAccessoriesClick?: () => void;
}

function TableInfo({
  session,
  tableId,
  tableType,
  now,
  onCafeBillClick,
  onAccessoriesClick,
}: Props) {
  const customerAccounts =
    useCustomerAccountStore(
      (state) => state.accounts
    );
  const sessionPlayers =
    getSessionPlayers(session);
  const isBooking =
    session.sessionType === "time" ||
    session.sessionType === "private";
  const bookingLabel =
    isBooking && sessionPlayers.length > 1
      ? `${sessionPlayers[0]} + ${
          sessionPlayers.length - 1
        } players`
      : sessionPlayers[0];
  const sessionCustomerIds = [
    session.player1CustomerId,
    session.player2CustomerId,
    session.player3CustomerId,
    session.player4CustomerId,
  ].filter(
    (id): id is string => Boolean(id)
  );
  const accountBelongsToSession = (
    account: CustomerAccount
  ) => sessionCustomerIds.includes(account.id);
  const activeSessionAccounts =
    customerAccounts.filter(
      (account) =>
        account.status === "active" &&
        account.paymentStatus === "unpaid" &&
        accountBelongsToSession(account)
    );
  const isAccessoryOrder = (item: {
    menuItemId?: string;
    name: string;
  }) =>
    item.menuItemId?.startsWith("ACC-") ||
    item.name.startsWith("[Accessory]");
  const billedCafeTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        account.cafeCharges
          .filter(
            (charge) =>
              !charge.name.startsWith("[Accessory]") &&
              (tableId === undefined ||
                charge.tableId === tableId ||
                !charge.tableId)
          )
          .reduce(
            (sum, charge) =>
              sum + charge.subtotal,
            0
          ),
      0
    );
  const billedAccessoriesTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total +
        (account.accessoryCharges ?? [])
          .filter(
            (charge) =>
              tableId === undefined ||
              charge.tableId === tableId ||
              !charge.tableId
          )
          .reduce(
            (sum, charge) =>
              sum + charge.subtotal,
            0
          ),
      0
    );
  const sessionAccessoriesTotal =
    session.cafeOrders
    .filter(
      isAccessoryOrder
    )
    .reduce(
      (total, item) => total + item.subtotal,
      0
    );
  const accessoriesTotal =
    billedAccessoriesTotal ||
    sessionAccessoriesTotal;
  const sessionCafeTotal = session.cafeOrders
    .filter(
      (item) => !isAccessoryOrder(item)
    )
    .reduce(
      (total, item) => total + item.subtotal,
      0
    );
  const cafeTotal =
    billedCafeTotal || sessionCafeTotal;
  const currentEndTime = session.pausedAt
    ? new Date(session.pausedAt)
    : session.endTime
      ? new Date(session.endTime)
      : now;
  const pricing = calculateGamePrice({
    sessionType: session.sessionType,
    tableType,
    startTime: new Date(session.startTime),
    endTime: currentEndTime,
  });
  const tableBill = calculateBill({
    gameAmount: pricing.gameAmount,
    cafeAmount: 0,
    discount: session.discount,
  }).total;
  const existingOpenBillTotal =
    activeSessionAccounts.reduce(
      (total, account) =>
        total + account.grandTotal,
      0
    );
  const currentBill =
    existingOpenBillTotal > 0
      ? existingOpenBillTotal + tableBill
      : tableBill + cafeTotal + accessoriesTotal;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
          <Users className="h-4 w-4" />
          Players
        </div>

        {isBooking ? (
          <p className="font-semibold text-slate-950">
            {bookingLabel}
          </p>
        ) : (
          sessionPlayers.map((player) => (
            <p
              key={player}
              className="font-semibold text-slate-950"
            >
              {player}
            </p>
          ))
        )}
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
          <Clock className="h-4 w-4" />
          Started
        </div>

        <p className="font-semibold text-slate-950">
          {new Date(
            session.startTime
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <p className="text-sm capitalize text-slate-500">
          {session.sessionType}
        </p>
      </div>

      <button
        type="button"
        className="rounded-lg bg-emerald-50 p-3 text-left transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        onClick={(event) => {
          event.stopPropagation();
          onCafeBillClick?.();
        }}
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Coffee className="h-4 w-4" />
          Cafe Bill
        </div>

        <p className="font-semibold text-emerald-800">
          Rs. {cafeTotal}
        </p>
      </button>

      <button
        type="button"
        className="rounded-lg bg-indigo-50 p-3 text-left transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={(event) => {
          event.stopPropagation();
          onAccessoriesClick?.();
        }}
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-700">
          <Package className="h-4 w-4" />
          Accessories
        </div>

        <p className="font-semibold text-indigo-800">
          Rs. {accessoriesTotal}
        </p>
      </button>

      <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-700">
              <CircleDollarSign className="h-4 w-4" />
              Current Bill
            </div>

            <p className="text-xs font-medium text-blue-600">
              Open bill + current table
            </p>
          </div>

          <p className="text-xl font-bold text-blue-800">
            Rs. {currentBill}
          </p>
        </div>
      </div>
    </div>
  );
}

export default TableInfo;
