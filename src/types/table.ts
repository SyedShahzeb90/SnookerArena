import type { Session } from "./session";

export type TableStatus =
  | "available"
  | "running"
  | "paused"
  | "payment-pending"
  | "reserved"
  | "maintenance";

export interface Table {
  id: number;

  name: string;

  type: "table" | "private-room";

  status: TableStatus;

  session?: Session;
}
