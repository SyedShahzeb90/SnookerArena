import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TableCard from "./TableCard";
import type { TableCardHandle } from "./TableCard";
import StartSessionDialog from "./StartSessionDialog";

import BillingDialog from "@/features/billing/components/BillingDialog";

import { useTableStore } from "@/store/tableStore";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

import type { PaymentMethod } from "@/types/session";
import type { Table } from "@/types/table";

function TableGrid() {
  const navigate = useNavigate();
  const tables = useTableStore((state) => state.tables);
  const runningTableCardView = useClubSettingsStore(
    (state) => state.settings.runningTableCardView
  );
  const standardTables = tables.filter(
    (table) => table.type === "table"
  );
  const privateRooms = tables.filter(
    (table) => table.type === "private-room"
  );

  const getStatusSummary = (items: Table[]) => {
    const labels = [
      ["available", "available"],
      ["running", "running"],
      ["paused", "paused"],
      ["payment-pending", "payment pending"],
    ] as const;

    return labels
      .map(([status, label]) => {
        const count = items.filter(
          (table) => table.status === status
        ).length;
        return count > 0 ? `${count} ${label}` : "";
      })
      .filter(Boolean)
      .join(" \u00b7 ");
  };

  const receivePayment = useTableStore(
    (state) => state.receivePayment
  );

  const [selectedTable, setSelectedTable] =
    useState<Table | null>(null);

  const [activeDialog, setActiveDialog] = useState<
    "start-session" | "billing" | null
  >(null);
  const [expandedTableId, setExpandedTableId] =
    useState<number | null>(null);
  const cardRefs = useRef(
    new Map<number, TableCardHandle>()
  );

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);

    switch (table.status) {
      case "available":
        setActiveDialog("start-session");
        break;

      case "payment-pending":
        setActiveDialog("billing");
        break;

      default:
        break;
    }
  };

  const closeDialog = () => {
    setActiveDialog(null);
  };

  useEffect(() => {
    setExpandedTableId(null);
  }, [runningTableCardView]);

  useEffect(() => {
    if (
      selectedTable &&
      !tables.some(
        (table) => table.id === selectedTable.id
      )
    ) {
      setSelectedTable(null);
      setActiveDialog(null);
    }
  }, [selectedTable, tables]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, button, [contenteditable='true'], [role='textbox'], [role='combobox']"
        )
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (
        ["a", "c", "e"].includes(key) &&
        (event.ctrlKey || event.altKey || event.metaKey)
      ) {
        return;
      }

      const blockingDialog = document.querySelector(
        "[data-slot='dialog-content'][data-open], [data-slot='dialog-content'][data-state='open']"
      );

      if (event.key === "Escape") {
        if (!blockingDialog && !activeDialog) {
          setSelectedTable(null);
        }
        return;
      }

      if (blockingDialog || activeDialog) return;

      const functionKey = event.key.match(/^F([1-7])$/);
      if (functionKey) {
        const tableNumber = Number(functionKey[1]);
        const table = tables.find(
          (candidate) =>
            candidate.type === "table" &&
            candidate.id === tableNumber
        );

        if (!table) return;

        event.preventDefault();
        handleTableClick(table);
        requestAnimationFrame(() => {
          cardRefs.current
            .get(table.id)
            ?.focusCard();
        });
        return;
      }

      if (!selectedTable) return;

      const currentTable = tables.find(
        (table) => table.id === selectedTable.id
      );
      if (!currentTable) return;

      if (
        key === "a" &&
        currentTable.status === "running" &&
        (currentTable.session?.sessionType === "single" ||
          currentTable.session?.sessionType === "double")
      ) {
        cardRefs.current
          .get(currentTable.id)
          ?.openAddFrame();
        return;
      }

      if (
        key === "c" &&
        (currentTable.status === "running" ||
          currentTable.status === "paused") &&
        currentTable.session
      ) {
        navigate(
          `/operator/cafe?tableId=${currentTable.id}&sessionId=${currentTable.session.id}`
        );
        return;
      }

      if (
        key === "e" &&
        currentTable.status === "running"
      ) {
        cardRefs.current
          .get(currentTable.id)
          ?.openEndSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [activeDialog, navigate, selectedTable, tables]);

  const handleReceivePayment = (
    paymentMethod: PaymentMethod,
    payerName?: string
  ) => {
    if (!selectedTable) return;

    receivePayment({
      tableId: selectedTable.id,
      paymentMethod,
      payerName,
    });

    closeDialog();
  };

  return (
    <>
      {[
        {
          title: "Standard Tables",
          count: `${standardTables.length} tables`,
          items: standardTables,
          empty: "No standard tables available.",
        },
        {
          title: "Private Rooms",
          count: `${privateRooms.length} rooms`,
          items: privateRooms,
          empty: "No private rooms available.",
        },
      ].map((section, sectionIndex) => (
        <section
          key={section.title}
          className={
            sectionIndex === 0
              ? ""
              : "mt-5 border-t border-slate-200 pt-4"
          }
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-bold text-slate-900">
              {section.title}
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {section.count}
            </span>
            {section.items.length > 0 && (
              <span className="text-xs text-slate-400">
                {getStatusSummary(section.items)}
              </span>
            )}
          </div>

          {section.items.length > 0 ? (
            <div className="grid grid-cols-1 items-start gap-3 min-[800px]:grid-cols-2 min-[1280px]:grid-cols-3 min-[1920px]:gap-4">
              {section.items.map((table) => (
                <TableCard
                  key={table.id}
                  ref={(handle) => {
                    if (handle) {
                      cardRefs.current.set(table.id, handle);
                    } else {
                      cardRefs.current.delete(table.id);
                    }
                  }}
                  table={table}
                  isDetailsExpanded={expandedTableId === table.id}
                  onDetailsExpandedChange={(expanded) => {
                    setExpandedTableId((current) =>
                      expanded
                        ? table.id
                        : current === table.id
                          ? null
                          : current
                    );
                  }}
                  onClick={() => handleTableClick(table)}
                  onHistoryClick={() =>
                    navigate(
                      `/operator/table-history?tableId=${table.id}`
                    )
                  }
                  onCafeBillClick={() => {
                    if (!table.session) return;

                    navigate(
                      `/operator/cafe?tableId=${table.id}&sessionId=${table.session.id}`
                    );
                  }}
                  onAccessoriesClick={() => {
                    if (!table.session) return;

                    navigate(
                      `/operator/accessories?tableId=${table.id}&sessionId=${table.session.id}`
                    );
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
              {section.empty}
            </p>
          )}
        </section>
      ))}

      <StartSessionDialog
        open={activeDialog === "start-session"}
        table={selectedTable}
        onOpenChange={(open) =>
          setActiveDialog(
            open ? "start-session" : null
          )
        }
      />

      {selectedTable?.session && (
        <BillingDialog
          open={activeDialog === "billing"}
          session={selectedTable.session}
          tableType={selectedTable.type}
          tableName={selectedTable.name}
          onClose={closeDialog}
          onReceivePayment={handleReceivePayment}
        />
      )}
    </>
  );
}

export default TableGrid;
