import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";

import type { CustomerAccount } from "../types/customerAccount";
import { formatAppTime } from "@/lib/dateTime";
import { getHistoryParticipantDisplayLabel } from "./participantDisplay";

function getChargeTableNames(account: CustomerAccount) {
  const tableNames = [
    ...account.gameCharges.map((charge) => charge.tableName),
    ...account.cafeCharges.map((charge) => charge.tableName),
    ...(account.accessoryCharges ?? []).map(
      (charge) => charge.tableName
    ),
    account.lastTableName,
  ];

  return Array.from(
    new Set(
      tableNames.filter(
        (name): name is string => Boolean(name?.trim())
      )
    )
  );
}

function getAccountTableNumber(
  account: CustomerAccount
) {
  const fromChargeTableId =
    account.gameCharges[0]?.tableId ??
    account.cafeCharges[0]?.tableId ??
    account.accessoryCharges?.[0]?.tableId;

  if (fromChargeTableId !== undefined) {
    return String(fromChargeTableId);
  }

  const fromTableName =
    account.lastTableName?.match(/\d+/)?.[0];

  return fromTableName;
}

function getAccountSequence(account: CustomerAccount) {
  return (
    account.customerToken.match(/\d+/)?.[0] ??
    account.staffBillNumber?.match(/\d+/)?.[0]
  );
}

export function formatCustomerDisplayLabel(
  account: CustomerAccount
) {
  const tableNumber = getAccountTableNumber(account);
  const sequence = getAccountSequence(account);

  if (!tableNumber || !sequence) {
    return getBillCustomerLabel(account);
  }

  return `${getBillCustomerLabel(account)} — T${tableNumber}-${sequence.padStart(
    3,
    "0"
  )}`;
}

export function formatBillTime(account: CustomerAccount) {
  const value = account.openedAt || account.lastActivityAt;
  if (!value) return "";

  return formatAppTime(value);
}

export function getBillTableLabel(account: CustomerAccount) {
  return account.lastTableName ?? getChargeTableNames(account)[0] ?? "";
}

export function getBillPrimaryLabel(account: CustomerAccount) {
  const customerLabel = getBillCustomerLabel(account);
  const baseCustomerLabel = getBaseBillCustomerLabel(account);

  if (!isWalkInName(account.customerName)) {
    return formatCustomerDisplayLabel(account);
  }

  if (customerLabel !== baseCustomerLabel) {
    return formatCustomerDisplayLabel(account);
  }

  return getWalkInDisplayName({
    name: account.customerName,
    tableId:
      account.gameCharges[0]?.tableId ??
      account.cafeCharges[0]?.tableId ??
      account.accessoryCharges?.[0]?.tableId,
    tableName: getBillTableLabel(account),
    tableType: account.gameCharges[0]?.tableType,
    time:
      account.gameCharges[0]?.startedAt ??
      account.openedAt ??
      account.lastActivityAt,
  });
}

function getBaseBillCustomerLabel(account: CustomerAccount) {
  if (isWalkInName(account.customerName)) {
    const note = account.customerNote?.trim();

    return note ? `Walk-in \u00b7 ${note}` : "Walk-in Customer";
  }

  const note = account.customerNote?.trim();

  return note
    ? `${account.customerName} \u00b7 ${note}`
    : account.customerName;
}

function getRelevantSessionIds(account: CustomerAccount) {
  return Array.from(
    new Set(
      [
        ...account.gameCharges.map((charge) => charge.sessionId),
        ...account.cafeCharges.map((charge) => charge.sessionId),
        ...(account.accessoryCharges ?? []).map(
          (charge) => charge.sessionId
        ),
      ].filter((sessionId): sessionId is string => Boolean(sessionId))
    )
  );
}

export function getBillCustomerLabel(account: CustomerAccount) {
  const baseLabel = getBaseBillCustomerLabel(account);

  if (!isWalkInName(account.customerName)) {
    return baseLabel;
  }

  const sessionIds = getRelevantSessionIds(account);
  const records = useTableHistoryStore
    .getState()
    .records.filter((record) =>
      sessionIds.includes(record.sessionId)
    )
    .sort(
      (a, b) =>
        new Date(b.endedAt).getTime() -
        new Date(a.endedAt).getTime()
    );

  for (const record of records) {
    const participantLabel = getHistoryParticipantDisplayLabel(
      record,
      account.id
    );

    if (participantLabel) {
      const note = account.customerNote?.trim();
      return note
        ? `${participantLabel} \u00b7 ${note}`
        : participantLabel;
    }
  }

  return baseLabel;
}

export function getBillDetailLabel(account: CustomerAccount) {
  const parts = [
    getBillPrimaryLabel(account),
    getBillTableLabel(account),
  ].filter(Boolean);

  return parts.join(" \u00b7 ");
}

export function getBillSecondaryLabel(account: CustomerAccount) {
  return getBillDetailLabel(account);
}

export function getBillMetaLabel(account: CustomerAccount) {
  const parts = [
    getBillTableLabel(account),
    formatBillTime(account)
      ? `Started ${formatBillTime(account)}`
      : "",
  ].filter(Boolean);

  return parts.join(" \u00b7 ");
}

export function getBillSearchText(account: CustomerAccount) {
  return [
    account.customerToken,
    account.staffBillNumber,
    account.customerName,
    getBillPrimaryLabel(account),
    getBillDetailLabel(account),
    getBillMetaLabel(account),
    account.customerNote,
    account.lastTableName,
    ...getChargeTableNames(account),
    formatBillTime(account),
    String(account.grandTotal),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function formatOpenCustomerOption(account: CustomerAccount) {
  const customerName = isWalkInName(account.customerName)
    ? "Walk-in Customer"
    : account.customerName;

  return [
    getBillPrimaryLabel(account),
    customerName,
    account.customerNote?.trim(),
    `Rs. ${account.grandTotal} unpaid`,
  ]
    .filter(Boolean)
    .filter(
      (value, index, values) =>
        values.indexOf(value) === index
    )
    .join(" \u00b7 ");
}
