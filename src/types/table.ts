export type TableStatus =
  | "available"
  | "single-game"
  | "double-game"
  | "time-booking";

export interface Table {
  id: number;
  name: string;
  type: "table" | "private-room";

  status: TableStatus;

  sessionId?: string;

  startedAt?: Date;

  players?: string[];
}