import { Building2, KeyRound, Pencil, RotateCcw, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { formatAppDate, formatAppTime } from "@/lib/dateTime";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@/types/session";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { createPinSalt, hashAdminPin, validatePinFormat, verifyAdminPin } from "@/features/admin-mode/pinSecurity";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";

import {
  DEFAULT_CLUB_SETTINGS,
  useClubSettingsStore,
  validateClubSettings,
  type ClubSettings,
  type ClubOperator,
} from "../store/clubSettingsStore";

type FormState = Omit<
  ClubSettings,
  | "singleGameRate"
  | "doubleGameRate"
  | "tableBookingRatePerMinute"
  | "frameWarningMinutes"
  | "frameDangerMinutes"
> & {
  singleGameRate: string;
  doubleGameRate: string;
  tableBookingRatePerMinute: string;
  frameWarningMinutes: string;
  frameDangerMinutes: string;
};

function toForm(settings: ClubSettings): FormState {
  return {
    ...settings,
    singleGameRate: String(settings.singleGameRate),
    doubleGameRate: String(settings.doubleGameRate),
    tableBookingRatePerMinute: String(settings.tableBookingRatePerMinute),
    frameWarningMinutes: String(settings.frameWarningMinutes),
    frameDangerMinutes: String(settings.frameDangerMinutes),
  };
}

function toSettings(form: FormState): ClubSettings {
  return {
    ...form,
    clubName: form.clubName.trim(),
    tagline: form.tagline.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
    operators: form.operators.map((operator) => ({
      ...operator,
      name: operator.name.trim(),
    })),
    singleGameRate: Number(form.singleGameRate),
    doubleGameRate: Number(form.doubleGameRate),
    tableBookingRatePerMinute: Number(form.tableBookingRatePerMinute),
    frameWarningMinutes: Number(form.frameWarningMinutes),
    frameDangerMinutes: Number(form.frameDangerMinutes),
  };
}

function ClubSettingsPage() {
  const settings = useClubSettingsStore((state) => state.settings);
  const updateSettings = useClubSettingsStore((state) => state.updateSettings);
  const resetSettingsToDefaults = useClubSettingsStore(
    (state) => state.resetSettingsToDefaults
  );
  const [form, setForm] = useState(() => toForm(settings));
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [editingOperatorId, setEditingOperatorId] = useState<string | null>(null);
  const [editingOperatorName, setEditingOperatorName] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const businessDays = useBusinessDayStore((state) => state.days);
  const enterAdminMode = useAdminModeStore((state) => state.enterAdminMode);

  useEffect(() => setForm(toForm(settings)), [settings]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors([]);
    setMessage("");
  };

  const save = () => {
    const numericFields = [
      form.singleGameRate,
      form.doubleGameRate,
      form.tableBookingRatePerMinute,
      form.frameWarningMinutes,
      form.frameDangerMinutes,
    ];
    if (numericFields.some((value) => value.trim() === "")) {
      setErrors(["Rate and timing fields cannot be empty."]);
      return;
    }
    const next = toSettings(form);
    const nextErrors = validateClubSettings(next);
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    updateSettings(next);
    if (!settings.adminPinHash && next.adminPinHash) {
      enterAdminMode();
    }
    setForm(toForm(next));
    setErrors([]);
    setMessage("Club settings saved successfully.");
  };

  const reset = () => {
    resetSettingsToDefaults();
    setForm(
      toForm({
        ...DEFAULT_CLUB_SETTINGS,
        operators: form.operators,
        adminPinHash: form.adminPinHash,
        adminPinSalt: form.adminPinSalt,
      })
    );
    setResetOpen(false);
    setErrors([]);
    setMessage("Club settings reset to defaults.");
  };

  const operatorNameExists = (name: string, exceptId?: string) => {
    const normalized = name.trim().toLocaleLowerCase();
    return form.operators.some(
      (operator) =>
        operator.id !== exceptId &&
        operator.name.trim().toLocaleLowerCase() === normalized
    );
  };

  const operatorWasUsed = (operator: ClubOperator) =>
    businessDays.some(
      (day) =>
        day.openedByOperatorId === operator.id ||
        (!day.openedByOperatorId &&
          day.openedBy.trim().toLocaleLowerCase() ===
            operator.name.trim().toLocaleLowerCase())
    );

  const addOperator = () => {
    const name = newOperatorName.trim();
    if (!name) {
      setErrors(["Operator name is required."]);
      return;
    }
    if (operatorNameExists(name)) {
      setErrors(["An operator with this name already exists."]);
      return;
    }
    const now = new Date().toISOString();
    update("operators", [
      ...form.operators,
      {
        id: `operator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        isActive: true,
        createdAt: now,
      },
    ]);
    setNewOperatorName("");
  };

  const saveOperatorName = (operatorId: string) => {
    const name = editingOperatorName.trim();
    if (!name) {
      setErrors(["Operator name is required."]);
      return;
    }
    if (operatorNameExists(name, operatorId)) {
      setErrors(["An operator with this name already exists."]);
      return;
    }
    update(
      "operators",
      form.operators.map((operator) =>
        operator.id === operatorId
          ? { ...operator, name, updatedAt: new Date().toISOString() }
          : operator
      )
    );
    setEditingOperatorId(null);
    setEditingOperatorName("");
  };

  const toggleOperator = (operatorId: string) => {
    update(
      "operators",
      form.operators.map((operator) =>
        operator.id === operatorId
          ? {
              ...operator,
              isActive: !operator.isActive,
              updatedAt: new Date().toISOString(),
            }
          : operator
      )
    );
  };

  const deleteOperator = (operator: ClubOperator) => {
    if (operatorWasUsed(operator)) {
      setErrors([`${operator.name} cannot be deleted because this operator has Business Day history. Disable the operator instead.`]);
      return;
    }
    if (!window.confirm(`Delete operator ${operator.name}?`)) return;
    update(
      "operators",
      form.operators.filter((item) => item.id !== operator.id)
    );
  };

  const prepareAdminPin = async () => {
    const pinError = validatePinFormat(newPin);
    if (pinError) {
      setErrors([pinError]);
      return;
    }
    if (newPin !== confirmPin) {
      setErrors(["New PIN and confirmation must match."]);
      return;
    }
    if (settings.adminPinHash) {
      const currentError = validatePinFormat(currentPin);
      if (currentError) {
        setErrors(["Current PIN is required and must be valid."]);
        return;
      }
      const validCurrentPin = await verifyAdminPin(
        currentPin,
        settings.adminPinHash,
        settings.adminPinSalt
      );
      if (!validCurrentPin) {
        setErrors(["Current Admin PIN is incorrect."]);
        return;
      }
    }
    const salt = createPinSalt();
    const hash = await hashAdminPin(newPin, salt);
    setForm((current) => ({ ...current, adminPinHash: hash, adminPinSalt: salt }));
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setErrors([]);
    setPinMessage("PIN change is ready. Click Save Settings to apply it.");
  };

  const numericInput = (
    key: "singleGameRate" | "doubleGameRate" | "tableBookingRatePerMinute" | "frameWarningMinutes" | "frameDangerMinutes",
    label: string,
    whole = false
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={whole ? 1 : 0}
        max={whole ? 1440 : 1000000}
        step={whole ? 1 : 0.01}
        value={form[key]}
        onChange={(event) => update(key, event.target.value)}
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Club Settings</h1>
            <p className="text-sm text-slate-500">Manage club details and defaults used for new activity.</p>
          </div>
        </header>

        {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>}
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-slate-950">Club Information</h2>
            <div className="mt-4 grid gap-4">
              <div className="space-y-1.5"><Label htmlFor="clubName">Club Name</Label><Input id="clubName" value={form.clubName} onChange={(event) => update("clubName", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="tagline">Header Subtitle</Label><Input id="tagline" value={form.tagline} onChange={(event) => update("tagline", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">Phone Number</Label><Input id="phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="address">Address</Label><Input id="address" value={form.address} onChange={(event) => update("address", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><Input id="currency" value="PKR" disabled /></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-slate-950">Display Format</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="timeFormat">Time Format</Label>
                <select id="timeFormat" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.timeFormat} onChange={(event) => update("timeFormat", event.target.value as ClubSettings["timeFormat"])}>
                  <option value="12-hour">12-hour - example: 7:30 PM</option>
                  <option value="24-hour">24-hour - example: 19:30</option>
                </select>
                <p className="text-xs text-slate-500">Current time: {formatAppTime(new Date(), form.timeFormat)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateFormat">Date Format</Label>
                <select id="dateFormat" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.dateFormat} onChange={(event) => update("dateFormat", event.target.value as ClubSettings["dateFormat"])}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY - example: 21/07/2026</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY - example: 07/21/2026</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD - example: 2026-07-21</option>
                </select>
                <p className="text-xs text-slate-500">Current date: {formatAppDate(new Date(), form.dateFormat)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-slate-950">Game and Booking Rates</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {numericInput("singleGameRate", "Single Game Rate")}
              {numericInput("doubleGameRate", "Double Game Rate")}
              <div className="sm:col-span-2">{numericInput("tableBookingRatePerMinute", "Table Booking Rate Per Minute")}</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Private-room rates remain managed by the existing room pricing.</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-slate-950">Frame Timing</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {numericInput("frameWarningMinutes", "Warning Time in Minutes", true)}
              {numericInput("frameDangerMinutes", "Danger Time in Minutes", true)}
            </div>
            <p className="mt-3 text-xs text-slate-500">Applies only to Single and Double Game frames on standard tables.</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-slate-950">Payment and Invoice</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="defaultPaymentMethod">Default Payment Method</Label>
                <select id="defaultPaymentMethod" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.defaultPaymentMethod} onChange={(event) => update("defaultPaymentMethod", event.target.value as PaymentMethod)}>
                  <option value="cash">Cash</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="card">Card</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="invoicePrefix">Invoice Prefix</Label><Input id="invoicePrefix" maxLength={12} value={form.invoicePrefix} onChange={(event) => update("invoicePrefix", event.target.value)} /></div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div>
            <h2 className="font-bold text-slate-950">Operators</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage the names available when starting a Business Day.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="New operator name"
              placeholder="Operator name"
              value={newOperatorName}
              onChange={(event) => setNewOperatorName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOperator();
                }
              }}
            />
            <Button type="button" className="shrink-0 gap-2" onClick={addOperator}>
              <UserPlus className="h-4 w-4" /> Add Operator
            </Button>
          </div>

          <div className="mt-4 divide-y rounded-lg border">
            {form.operators.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-slate-500">
                No operators added yet.
              </p>
            ) : (
              form.operators.map((operator) => {
                const used = operatorWasUsed(operator);
                const editing = editingOperatorId === operator.id;
                return (
                  <div key={operator.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <Input
                          aria-label={`Edit ${operator.name}`}
                          value={editingOperatorName}
                          onChange={(event) => setEditingOperatorName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveOperatorName(operator.id);
                            if (event.key === "Escape") setEditingOperatorId(null);
                          }}
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">{operator.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${operator.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {operator.isActive ? "Active" : "Disabled"}
                          </span>
                          {used && <span className="text-xs text-slate-500">Used in history</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <Button type="button" size="sm" onClick={() => saveOperatorName(operator.id)}>Save</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingOperatorId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              setEditingOperatorId(operator.id);
                              setEditingOperatorName(operator.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => toggleOperator(operator.id)}>
                            {operator.isActive ? "Disable" : "Re-enable"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-700"
                            disabled={used}
                            title={used ? "Used operators cannot be deleted" : "Delete operator"}
                            onClick={() => deleteOperator(operator)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Operator changes take effect after Save Settings. Used operators can be disabled, but not deleted.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-slate-600" />
            <div>
              <h2 className="font-bold text-slate-950">Admin Security</h2>
              <p className="mt-1 text-sm text-slate-500">
                {settings.adminPinHash ? "Change the local Admin Mode PIN." : "Create the first local Admin Mode PIN."}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {settings.adminPinHash && (
              <div className="space-y-1.5">
                <Label htmlFor="currentAdminPin">Current PIN</Label>
                <Input id="currentAdminPin" type="password" inputMode="numeric" autoComplete="off" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="newAdminPin">New PIN</Label>
              <Input id="newAdminPin" type="password" inputMode="numeric" autoComplete="off" value={newPin} onChange={(event) => setNewPin(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmAdminPin">Confirm New PIN</Label>
              <Input id="confirmAdminPin" type="password" inputMode="numeric" autoComplete="off" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} />
            </div>
          </div>
          {pinMessage && <p className="mt-3 text-sm font-medium text-emerald-700">{pinMessage}</p>}
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => void prepareAdminPin()}>
              {settings.adminPinHash ? "Change Admin PIN" : "Set Admin PIN"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">The PIN is stored as a one-way hash. This is local accidental-access protection, not full authentication.</p>
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Backup Preference</h2>
              <p className="mt-1 text-sm text-slate-500">Store the reminder preference without scheduling automatic downloads.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.backupReminderEnabled} onChange={(event) => update("backupReminderEnabled", event.target.checked)} /> Enable Backup Reminder</label>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="gap-2 text-red-700" onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" /> Reset to Defaults</Button>
          <Button className="gap-2 bg-slate-950 text-white hover:bg-slate-800" onClick={save}><Save className="h-4 w-4" /> Save Settings</Button>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reset Club Settings?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Only Club Settings will be reset. Sessions, bills, sales, customers, and history will not be changed.</p></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button><Button className="bg-red-700 text-white hover:bg-red-800" onClick={reset}>Reset to Defaults</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default ClubSettingsPage;
