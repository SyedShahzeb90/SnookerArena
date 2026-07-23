import {
  AlertTriangle,
  ArchiveRestore,
  Database,
  Download,
  FileJson,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccessoriesStore } from "@/features/accessories/store/accessoriesStore";
import { useCheckoutStore } from "@/features/billing/store/checkoutStore";
import { useCafeStore } from "@/features/cafe/store/cafeStore";
import { useCreditLedgerStore } from "@/features/credit-ledger/store/creditLedgerStore";
import { useCustomerAccountStore } from "@/features/customers/store/customerAccountStore";
import { useOutsidePurchaseStore } from "@/features/outside-purchases/store/outsidePurchaseStore";
import { useSalesStore } from "@/features/sales/store/salesStore";
import { useTableHistoryStore } from "@/features/table-history/store/tableHistoryStore";
import { useTableStore } from "@/store/tableStore";
import { formatAppDateTime, useAppDateTimeFormats } from "@/lib/dateTime";

import {
  downloadApplicationBackup,
  exportApplicationBackup,
  restoreApplicationBackup,
  summarizeBackup,
  validateApplicationBackup,
  type SnookerArenaBackup,
} from "../applicationBackup";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";

function formatDate(value: string) {
  return formatAppDateTime(value);
}

function BackupRestorePage() {
  useAppDateTimeFormats();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tables = useTableStore((state) => state.tables);
  const customerAccounts = useCustomerAccountStore((state) => state.accounts);
  const pendingBills = useCheckoutStore((state) => state.pendingBills);
  const sales = useSalesStore((state) => state.sales);
  const savedCafeOrders = useCafeStore((state) => state.savedOrders);
  const menu = useCafeStore((state) => state.menu);
  const accessories = useAccessoriesStore((state) => state.items);
  const creditEntries = useCreditLedgerStore((state) => state.entries);
  const historyRecords = useTableHistoryStore((state) => state.records);
  const outsidePurchases = useOutsidePurchaseStore((state) => state.purchases);

  const [selectedBackup, setSelectedBackup] = useState<SnookerArenaBackup | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [error, setError] = useState("");

  const applicationCounts = useMemo(
    () => [
      ["Running sessions", tables.filter((table) => table.status === "running" || table.status === "paused").length],
      ["Customer bills", customerAccounts.length],
      ["Pending checkout records", pendingBills.filter((bill) => bill.status === "pending").length],
      ["Sales", sales.length],
      ["Cafe records", savedCafeOrders.length],
      ["Accessories", accessories.length],
      ["Credit records", creditEntries.length],
      ["Table-history rows", historyRecords.length],
      ["Customer outside purchases", outsidePurchases.length],
      ["Menu products", menu.length],
    ] as const,
    [
      accessories.length,
      creditEntries.length,
      customerAccounts.length,
      historyRecords.length,
      menu.length,
      outsidePurchases.length,
      pendingBills,
      sales.length,
      savedCafeOrders.length,
      tables,
    ]
  );

  const handleExport = async () => {
    setIsExporting(true);
    setError("");
    try {
      const backup = await exportApplicationBackup();
      downloadApplicationBackup(backup);
      setLastExportedAt(backup.exportedAt);
      toast.success({
        title: "Backup Completed",
        description: "Application backup downloaded successfully.",
      });
    } catch (caught) {
      toast.error({
        title: "Backup Failed",
        description:
          caught instanceof Error
            ? caught.message
            : "The backup could not be exported.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFile = async (file?: File) => {
    setError("");
    setSelectedBackup(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Select a JSON backup file.");
      return;
    }
    if (file.size === 0 || file.size > 100 * 1024 * 1024) {
      setError("The selected backup is empty or too large.");
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      setSelectedBackup(validateApplicationBackup(parsed));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected backup is invalid.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    if (!selectedBackup || isRestoring) return;
    setIsRestoring(true);
    setError("");
    try {
      await restoreApplicationBackup(selectedBackup);
      useAdminModeStore.getState().exitAdminMode("Admin Mode was locked after backup restore.");
      setSelectedBackup(null);
      setRestoreComplete(true);
      toast.success({
        title: "Backup Restored",
        description: "Application data was restored successfully.",
      });
    } catch (caught) {
      setSelectedBackup(null);
      const description =
        caught instanceof Error
          ? caught.message
          : "Restore failed. Current data was recovered.";
      setError(description);
      toast.error({ title: "Unable to Restore", description });
    } finally {
      setIsRestoring(false);
    }
  };

  const selectedSummary = selectedBackup ? summarizeBackup(selectedBackup) : null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
            <ArchiveRestore className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Backup &amp; Restore</h1>
            <p className="text-sm text-slate-500">Protect and recover Snooker Arena application data.</p>
          </div>
        </header>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Download className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="font-bold text-slate-950">Backup Application Data</h2>
                <p className="mt-1 text-sm text-slate-500">Download one JSON file containing all owned browser records.</p>
              </div>
            </div>
            <Button className="mt-5 w-full gap-2 bg-slate-950 text-white hover:bg-slate-800" disabled={isExporting} onClick={handleExport}>
              <Download className="h-4 w-4" />
              {isExporting ? "Preparing Backup..." : "Export Backup"}
            </Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <h2 className="font-bold text-slate-950">Restore Application Data</h2>
                <p className="mt-1 text-sm text-slate-500">Validate a backup before replacing current local data.</p>
              </div>
            </div>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <Button variant="outline" className="mt-5 w-full gap-2" onClick={() => fileInputRef.current?.click()}>
              <FileJson className="h-4 w-4" />
              Restore Backup
            </Button>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-600" />
              <h2 className="font-bold text-slate-950">Storage Summary</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {applicationCounts.map(([label, count]) => (
                <div key={label} className="border-b border-slate-100 pb-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">{count}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-bold text-slate-950">Last Backup Information</h2>
              <p className="mt-2 text-sm text-slate-500">
                {lastExportedAt ? `Exported ${formatDate(lastExportedAt)}` : "No backup exported during this visit."}
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <h2 className="font-bold text-slate-950">Safety Notes</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">Restore replaces owned application storage; it never merges records or clears unrelated browser data. A rollback snapshot is captured first.</p>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedBackup)} onOpenChange={(open) => !open && !isRestoring && setSelectedBackup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Data Restore</DialogTitle>
          </DialogHeader>
          {selectedBackup && selectedSummary && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Current Snooker Arena data will be completely replaced. This backup will not be merged.</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Created</dt><dd className="font-semibold">{formatDate(selectedBackup.exportedAt)}</dd></div>
                <div><dt className="text-slate-500">Backup version</dt><dd className="font-semibold">{selectedBackup.backupVersion}</dd></div>
                <div><dt className="text-slate-500">Local records</dt><dd className="font-semibold">{selectedSummary.localStorageRecords}</dd></div>
                <div><dt className="text-slate-500">IndexedDB records</dt><dd className="font-semibold">{selectedSummary.indexedDbRecords} in {selectedSummary.indexedDbStores} stores</dd></div>
              </dl>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={isRestoring} onClick={() => setSelectedBackup(null)}>Cancel</Button>
                <Button className="bg-red-700 text-white hover:bg-red-800" disabled={isRestoring} onClick={() => void confirmRestore()}>
                  {isRestoring ? "Restoring..." : "Restore Data"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={restoreComplete} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader><DialogTitle>Restore Complete</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">The backup was restored successfully. Reload the application now to load the restored data into every screen.</p>
            <Button className="w-full gap-2 bg-slate-950 text-white hover:bg-slate-800" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Reload Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default BackupRestorePage;
