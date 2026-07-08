export type SessionType =
  | "single-game"
  | "double-game"
  | "time-booking";

export type TableStatus =
  | "available"
  | "running"
  | "payment-pending";

export interface Table {
  id: number;
  name: string;
  type: "table" | "private-room";

  status: TableStatus;

  sessionType?: SessionType;

  players?: string[];

  sessionId?: string;

  startedAt?: number;
}