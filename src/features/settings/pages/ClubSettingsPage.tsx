import { Building2, KeyRound, LoaderCircle, Pencil, RotateCcw, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { useToast } from "@/components/ui/toast";
import type { PaymentMethod } from "@/types/session";
import { useBusinessDayStore } from "@/features/business-day/store/businessDayStore";
import { createPinSalt, hashAdminPin, validatePinFormat, verifyAdminPin } from "@/features/admin-mode/pinSecurity";
import { useAdminModeStore } from "@/features/admin-mode/adminModeStore";
import { ClubLogo, type LogoFitMode } from "@/features/settings/components/ClubLogo";

import {
  DEFAULT_CLUB_SETTINGS,
  useClubSettingsStore,
  validateClubSettings,
  type ClubSettings,
  type ClubOperator,
} from "../store/clubSettingsStore";

const LOGO_MAX_FILE_SIZE = 2 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 256;
const SUPPORTED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read the selected logo."));
    };
    reader.onerror = () => reject(new Error("Could not read the selected logo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected logo."));
    image.src = dataUrl;
  });
}

async function processLogoFile(file: File) {
  if (!SUPPORTED_LOGO_TYPES.has(file.type)) {
    throw new Error("Logo must be a PNG, JPG, JPEG, or WebP image.");
  }
  if (file.size > LOGO_MAX_FILE_SIZE) {
    throw new Error("Logo file must be 2 MB or smaller.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_MAX_DIMENSION;
  canvas.height = LOGO_MAX_DIMENSION;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Logo could not be prepared.");
  }

  context.clearRect(0, 0, LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION);
  const scale = Math.min(
    LOGO_MAX_DIMENSION / image.naturalWidth,
    LOGO_MAX_DIMENSION / image.naturalHeight,
    1,
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.round((LOGO_MAX_DIMENSION - width) / 2);
  const y = Math.round((LOGO_MAX_DIMENSION - height) / 2);
  context.drawImage(image, x, y, width, height);

  return canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
}

function ClubSettingsPage() {
  const settings = useClubSettingsStore((state) => state.settings);
  const updateSettings = useClubSettingsStore((state) => state.updateSettings);
  const resetSettingsToDefaults = useClubSettingsStore(
    (state) => state.resetSettingsToDefaults
  );
  const [form, setForm] = useState(() => toForm(settings));
  const [errors, setErrors] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [editingOperatorId, setEditingOperatorId] = useState<string | null>(null);
  const [editingOperatorName, setEditingOperatorName] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const businessDays = useBusinessDayStore((state) => state.days);
  const enterAdminMode = useAdminModeStore((state) => state.enterAdminMode);

  useEffect(() => setForm(toForm(settings)), [settings]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors([]);
  };

  const updateLogoSettings = (
    logoSettings: Pick<ClubSettings, "customLogoDataUrl" | "customLogoFit">
  ) => {
    setForm((current) => ({ ...current, ...logoSettings }));
    updateSettings({ ...settings, ...logoSettings });
    setErrors([]);
  };

  const save = async () => {
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
    setIsSaving(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      updateSettings(next);
      if (!settings.adminPinHash && next.adminPinHash) {
        enterAdminMode();
      }
      setForm(toForm(next));
      setErrors([]);
      toast.success({
        title: "Settings Saved",
        description: "Club settings have been updated successfully.",
      });
    } catch {
      toast.error({ title: "Unable to Save", description: "Please try again." });
    } finally {
      setIsSaving(false);
    }
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
    toast.success({
      title: "Settings Restored",
      description: "Club settings were reset to their defaults.",
    });
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
    toast.info({
      title: "Operator Added",
      description: `${name} will be available after Save Settings.`,
    });
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
    toast.success({
      title: "Operator Removed",
      description: `${operator.name} will be removed after Save Settings.`,
    });
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const customLogoDataUrl = await processLogoFile(file);
      updateLogoSettings({
        customLogoDataUrl,
        customLogoFit: form.customLogoFit ?? "contain",
      });
      toast.success({
        title: "Logo Uploaded",
        description: "The club logo has been updated.",
      });
    } catch (error) {
      toast.error({
        title: "Unable to Upload Logo",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const removeLogo = () => {
    updateLogoSettings({
      customLogoDataUrl: undefined,
      customLogoFit: form.customLogoFit ?? "contain",
    });
    toast.info({
      title: "Default Logo Restored",
      description: "The custom club logo has been removed.",
    });
  };

  const updateLogoFit = (customLogoFit: LogoFitMode) => {
    updateLogoSettings({
      customLogoDataUrl: form.customLogoDataUrl,
      customLogoFit,
    });
    toast.info({
      title: "Logo Fit Updated",
      description: `Logo fit is now ${customLogoFit}.`,
    });
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
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <Label>Club Logo</Label>
                <div className="flex min-h-24 items-center gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 sm:gap-5">
                  <ClubLogo
                    alt="Club logo preview"
                    fit={form.customLogoFit ?? "contain"}
                    size="preview"
                    src={form.customLogoDataUrl}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">
                      {form.clubName || "Snooker Arena"}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {form.tagline || "Club Management System"}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="customLogoFit">Logo Fit</Label>
                      <select
                        id="customLogoFit"
                        className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
                        value={form.customLogoFit ?? "contain"}
                        onChange={(event) =>
                          updateLogoFit(event.target.value as LogoFitMode)
                        }
                      >
                        <option value="contain">Contain (Recommended)</option>
                        <option value="cover">Cover</option>
                        <option value="fill">Fill</option>
                      </select>
                    </div>

                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) =>
                        void handleLogoUpload(event.target.files?.[0])
                      }
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        className="bg-slate-950 text-white hover:bg-slate-800"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        Upload Logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={removeLogo}
                        disabled={!form.customLogoDataUrl}
                      >
                        Restore Default
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={removeLogo}
                        disabled={!form.customLogoDataUrl}
                      >
                        Remove Logo
                      </Button>
                    </div>

                  <p className="text-xs leading-5 text-slate-500">
                    For the best result, upload a transparent PNG or WebP logo. JPG and JPEG are also supported. Maximum size: 2 MB.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="phone">Phone Number</Label><Input id="phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="address">Address</Label><Input id="address" value={form.address} onChange={(event) => update("address", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><Input id="currency" value="PKR" disabled /></div>
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" className="gap-2 text-red-700" onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" /> Reset to Defaults</Button>
          <Button
            className="gap-2 bg-slate-950 text-white hover:bg-slate-800"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
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
