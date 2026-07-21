import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

import { useAdminModeStore } from "./adminModeStore";
import type { AppPermission } from "./permissions";

interface Props {
  permission: AppPermission;
  children: ReactNode;
  allowPinSetup?: boolean;
}

export default function RequirePermission({ permission, children, allowPinSetup = false }: Props) {
  const location = useLocation();
  const can = useAdminModeStore((state) => state.can(permission));
  const requestAdminMode = useAdminModeStore((state) => state.requestAdminMode);
  const hasPin = useClubSettingsStore((state) => Boolean(state.settings.adminPinHash));

  if (can || (allowPinSetup && !hasPin)) return children;

  return (
    <main className="min-h-[calc(100vh-89px)] bg-slate-100 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-6 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" />
        <h1 className="mt-3 text-xl font-bold text-slate-950">Admin Mode required</h1>
        <p className="mt-2 text-sm text-slate-500">This page contains management settings or sensitive actions.</p>
        {hasPin ? (
          <Button className="mt-5" onClick={() => requestAdminMode(location.pathname)}>Enter Admin Mode</Button>
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Create the first Admin PIN from Club Settings.</p>
        )}
      </div>
    </main>
  );
}
