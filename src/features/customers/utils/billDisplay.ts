import {
  getWalkInDisplayName,
  isWalkInName,
} from "@/features/sessions/utils/walkInLabel";

import type { CustomerAccount } from "../types/customerAccount";
import { formatAppTime } from "@/lib/dateTime";

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
  if (!isWalkInName(account.customerName)) {
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

export function getBillCustomerLabel(account: CustomerAccount) {
  if (isWalkInName(account.customerName)) {
    const note = account.customerNote?.trim();

    return note ? `Walk-in \u00b7 ${note}` : "Walk-in Customer";
  }

  const note = account.customerNote?.trim();

  return note
    ? `${account.customerName} \u00b7 ${note}`
    : account.customerName;
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
