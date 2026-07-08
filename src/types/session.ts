export type SessionType =
  | "single"
  | "double"
  | "time"
  | "private";

export interface Session {
  id: string;

  tableId: number;

  sessionType: SessionType;

  player1: string;

  player2?: string;

  startTime: Date;

  endTime?: Date;

  isPaid: boolean;
}