type WalkInLabelInput = {
  name?: string | null;
  tableId?: number | null;
  tableName?: string | null;
  tableType?: string | null;
  time?: Date | string | number | null;
};

export function isWalkInName(name?: string | null) {
  const value = name?.trim();

  return (
    !value ||
    /^walk-in customer(?: \(\d+\))?$/i.test(value) ||
    /^walk-in$/i.test(value)
  );
}

function formatWalkInTime(
  value?: Date | string | number | null
) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "00:00";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function getWalkInBillPrefix(input: WalkInLabelInput) {
  const tableName = input.tableName?.trim() ?? "";
  const numberFromName = tableName.match(/\d+/)?.[0];
  const number = numberFromName ?? input.tableId ?? "";
  if (!number) return "C";

  const isPrivateRoom =
    input.tableType === "private-room" ||
    /^pr/i.test(tableName) ||
    /private/i.test(tableName);

  return `${isPrivateRoom ? "PR" : "T"}${number}`;
}

export function formatWalkInBillNumber(
  prefix: string,
  sequence: number
) {
  return `${prefix}-WI-${String(sequence).padStart(3, "0")}`;
}

export function getWalkInDisplayName(input: WalkInLabelInput) {
  if (!isWalkInName(input.name)) {
    return input.name?.trim() ?? "";
  }

  const tableCode = getWalkInBillPrefix(input);
  const prefix = tableCode ? `${tableCode}-` : "";

  return `${prefix}Walk-in-${formatWalkInTime(input.time)}`;
}
