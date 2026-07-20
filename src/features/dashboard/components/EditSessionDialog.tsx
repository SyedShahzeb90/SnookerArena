import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useTableStore } from "@/store/tableStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { isWalkInName } from "@/features/sessions/utils/walkInLabel";

import type { Table } from "@/types/table";

import SessionForm from "./SessionForm";

interface Props {
  open: boolean;
  table: Table | null;
  onOpenChange: (open: boolean) => void;
}

function EditSessionDialog({
  open,
  table,
  onOpenChange,
}: Props) {
  const [undoBusy, setUndoBusy] =
    useState(false);
  const updateSession = useTableStore(
    (state) => state.updateSession
  );
  const createCustomerAccount =
    useCustomerAccountStore(
      (state) => state.createCustomerAccount
    );
  const getOrCreateActiveCustomerByIdOrName =
    useCustomerAccountStore(
      (state) =>
        state.getOrCreateActiveCustomerByIdOrName
    );

  const resolveSessionCustomerId = (
    name: string,
    customerId?: string,
    mode: "quick" | "existing" = "quick"
  ) => {
    const customerName =
      name.trim() || "Walk-in Customer";

    if (customerId) {
      return customerId;
    }

    if (mode === "quick" || isWalkInName(customerName)) {
      return createCustomerAccount({
        customerName: isWalkInName(customerName)
          ? "Walk-in Customer"
          : customerName,
      }).id;
    }

    return getOrCreateActiveCustomerByIdOrName({
      customerName,
    }).id;
  };

  const frameCount =
    (table?.session?.tableChargeLines ?? []).filter(
      (line) =>
        line.type === "singleGame" ||
        line.type === "doubleGame"
    ).length;

  const handleUndoLastFrame = () => {
    const session = table?.session;
    if (!session || undoBusy) return;

    if (
      (session.sessionType !== "single" &&
        session.sessionType !== "double") ||
      frameCount <= 1
    ) {
      window.alert("The initial frame cannot be removed.");
      return;
    }

    const gameChargeLines =
      session.tableChargeLines?.filter(
        (line) =>
          line.type === "singleGame" ||
          line.type === "doubleGame"
      ) ?? [];

    const confirmed = window.confirm(
      "Remove the most recently added frame? The session bill will be recalculated."
    );

    if (!confirmed) {
      return;
    }

    const nextGameChargeLines =
      gameChargeLines.slice(0, -1);

    setUndoBusy(true);
    try {
      updateSession({
        tableId: table.id,
        player1: session.player1,
        player1CustomerId:
          session.player1CustomerId,
        player2: session.player2 ?? "",
        player2CustomerId:
          session.player2CustomerId,
        player3: session.player3 ?? "",
        player3CustomerId:
          session.player3CustomerId,
        player4: session.player4 ?? "",
        player4CustomerId:
          session.player4CustomerId,
        extraPlayers: session.extraPlayers ?? [],
        teamAOneNameEnough:
          session.teamAOneNameEnough,
        teamBOneNameEnough:
          session.teamBOneNameEnough,
        teamABillOwnerCustomerId: session.teamABillOwnerCustomerId,
        teamABillOwnerName: session.teamABillOwnerName,
        teamBBillOwnerCustomerId: session.teamBBillOwnerCustomerId,
        teamBBillOwnerName: session.teamBBillOwnerName,
        sessionType: session.sessionType,
        startTime: new Date(session.startTime),
        tableChargeLines: [
          ...(session.tableChargeLines ?? []).filter(
            (line) =>
              line.type !== "singleGame" &&
              line.type !== "doubleGame"
          ),
          ...nextGameChargeLines,
        ],
      });

      window.alert("Last frame removed.");
    } finally {
      setUndoBusy(false);
    }
  };

  if (!table || !table.session) {
    return null;
  }

  return (
    <Dialog
      open={open}
        onOpenChange={onOpenChange}
      >
      <DialogContent className="flex max-h-[calc(100vh-3rem)] w-[min(94vw,520px)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b pb-3">
          <DialogTitle>
            Edit Session - {table.name}
          </DialogTitle>
        </DialogHeader>

        <SessionForm
          tableId={table.id}
          tableType={table.type}
          session={table.session}
          submitLabel="Save Changes"
          onUndoLastFrame={handleUndoLastFrame}
          canUndoLastFrame={
            (table.session.sessionType === "single" ||
              table.session.sessionType === "double") &&
            frameCount > 1
          }
          undoLastFrameBusy={undoBusy}
          onSubmit={(data) => {
            const player1Name =
              data.player1.trim() ||
              "Walk-in Customer";
            const player1CustomerId =
              resolveSessionCustomerId(
                player1Name,
                data.player1CustomerId,
                data.player1Mode
              );
            const player2CustomerId =
              data.player2.trim()
                ? resolveSessionCustomerId(
                    data.player2,
                    data.player2CustomerId,
                    data.player2Mode
                  )
                : undefined;
            const player3CustomerId =
              data.player3.trim()
                ? resolveSessionCustomerId(
                    data.player3,
                    data.player3CustomerId,
                    data.player3Mode
                  )
                : undefined;
            const player4CustomerId =
              data.player4.trim()
                ? resolveSessionCustomerId(
                    data.player4,
                    data.player4CustomerId,
                    data.player4Mode
                  )
                : undefined;

            updateSession({
              tableId: table.id,
              player1: player1Name,
              player1CustomerId,
              player2: data.player2,
              player2CustomerId,
              player3: data.player3,
              player3CustomerId,
              player4: data.player4,
              player4CustomerId,
              extraPlayers: data.extraPlayers,
              teamAOneNameEnough:
                data.teamAOneNameEnough,
              teamBOneNameEnough:
                data.teamBOneNameEnough,
              teamABillOwnerCustomerId: undefined,
              teamABillOwnerName: undefined,
              teamBBillOwnerCustomerId: undefined,
              teamBBillOwnerName: undefined,
              sessionType: data.sessionType,
              startTime: data.startTime,
              tableChargeLines:
                table.session.tableChargeLines?.map((line, index, lines) =>
                  index === lines.length - 1 &&
                  (line.type === "singleGame" || line.type === "doubleGame")
                    ? {
                        ...line,
                        isFinal: data.isFinal,
                        finalGames: data.isFinal ? data.finalGames : undefined,
                      }
                    : line
                ),
            });

            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default EditSessionDialog;
