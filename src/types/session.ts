export type SessionType =
  | "single-game"
  | "double-game"
  | "time-booking";

export interface Session {
  id: string;

  tableId: number;

  tableName: string;

  type: SessionType;

  startedAt: Date;

  players: string[];

  status: "running" | "finished";
}