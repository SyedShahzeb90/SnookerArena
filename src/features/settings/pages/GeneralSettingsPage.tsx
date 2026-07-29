import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading, PageShell } from "@/components/layout/page-layout";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/features/theme/ThemeProvider";
import { useClubSettingsStore, type ClubSettings } from "../store/clubSettingsStore";
import { INTERFACE_SCALE_OPTIONS, type InterfaceScale } from "../interfaceScale";

function GeneralSettingsPage() {
  const settings = useClubSettingsStore((state) => state.settings);
  const updateSettings = useClubSettingsStore((state) => state.updateSettings);
  const toast = useToast();
  const { resolvedTheme, setPreference } = useTheme();
  const [draft, setDraft] = useState({
    interfaceScale: settings.interfaceScale,
    displayDensity: settings.displayDensity,
    runningTableCardView: settings.runningTableCardView,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
  });

  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "interfaceScale") updateSettings({ ...settings, interfaceScale: value as InterfaceScale });
    if (key === "displayDensity") updateSettings({ ...settings, displayDensity: value as ClubSettings["displayDensity"] });
    if (key === "runningTableCardView") updateSettings({ ...settings, runningTableCardView: value as ClubSettings["runningTableCardView"] });
  };

  const save = () => {
    updateSettings({ ...settings, ...draft });
    toast.success({ title: "Settings Saved", description: "General preferences have been updated." });
  };

  return (
    <PageShell width="compact">
        <PageHeading
          icon={SlidersHorizontal}
          title="General Settings"
          description="Application-wide appearance and usability preferences."
        />
        <Card className="p-5">
          <h2 className="font-bold text-slate-950 dark:text-slate-100">Appearance</h2>
          <p className="mt-1 text-sm text-slate-500">Choose how the application looks.</p>
          <div className="mt-4 max-w-md space-y-1.5"><Label htmlFor="general-theme">Theme</Label><select id="general-theme" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={resolvedTheme} onChange={(event) => setPreference(event.target.value as "light" | "dark")}><option value="light">Light</option><option value="dark">Dark</option></select></div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-950 dark:text-slate-100">Display & Layout</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="general-scale">Interface Scale</Label><select id="general-scale" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.interfaceScale} onChange={(event) => update("interfaceScale", Number(event.target.value) as InterfaceScale)}>{INTERFACE_SCALE_OPTIONS.map((scale) => <option key={scale} value={scale}>{scale}%{scale === 100 ? " (default)" : ""}</option>)}</select><p className="text-xs text-slate-500">Applies immediately without reloading.</p></div>
            <div className="space-y-1.5"><Label htmlFor="display-density">Display Density</Label><select id="display-density" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.displayDensity} onChange={(event) => update("displayDensity", event.target.value as typeof draft.displayDensity)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="touch">Touch</option></select><p className="text-xs text-slate-500">Comfortable spacing is recommended for normal laptop use.</p></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="running-table-card-view">Running Table Card View</Label>
              <select
                id="running-table-card-view"
                className="h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={draft.runningTableCardView}
                onChange={(event) =>
                  update(
                    "runningTableCardView",
                    event.target.value as ClubSettings["runningTableCardView"],
                  )
                }
              >
                <option value="full">Full Details</option>
                <option value="compact-expand">Compact + Expand</option>
              </select>
              <p className="text-xs text-slate-500">
                {draft.runningTableCardView === "full"
                  ? "Always show all running-table information and actions."
                  : "Show essential information first. Click a card to reveal full details and controls."}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5"><h2 className="font-bold text-slate-950 dark:text-slate-100">Date & Time</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="general-date-format">Date Format</Label><select id="general-date-format" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.dateFormat} onChange={(event) => setDraft((current) => ({ ...current, dateFormat: event.target.value as typeof current.dateFormat }))}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></div><div className="space-y-1.5"><Label htmlFor="general-time-format">Time Format</Label><select id="general-time-format" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={draft.timeFormat} onChange={(event) => setDraft((current) => ({ ...current, timeFormat: event.target.value as typeof current.timeFormat }))}><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></select></div></div></Card>
        <div className="flex justify-end"><Button onClick={save}>Save General Settings</Button></div>
    </PageShell>
  );
}

export default GeneralSettingsPage;
