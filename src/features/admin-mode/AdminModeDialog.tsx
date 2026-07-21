import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

import { useAdminModeStore } from "./adminModeStore";
import { validatePinFormat, verifyAdminPin } from "./pinSecurity";

export default function AdminModeDialog() {
  const navigate = useNavigate();
  const open = useAdminModeStore((state) => state.pinDialogOpen);
  const requestedPath = useAdminModeStore((state) => state.requestedPath);
  const enterAdminMode = useAdminModeStore((state) => state.enterAdminMode);
  const closePinDialog = useAdminModeStore((state) => state.closePinDialog);
  const { adminPinHash, adminPinSalt } = useClubSettingsStore((state) => state.settings);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    const formatError = validatePinFormat(pin);
    if (formatError) {
      setError(formatError);
      return;
    }
    if (!adminPinHash || !adminPinSalt) {
      setError("Set the first Admin PIN in Club Settings.");
      return;
    }
    setChecking(true);
    const valid = await verifyAdminPin(pin, adminPinHash, adminPinSalt);
    setChecking(false);
    if (!valid) {
      setError("Incorrect Admin PIN.");
      return;
    }
    enterAdminMode();
    if (requestedPath) navigate(requestedPath);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closePinDialog()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Enter Admin Mode</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="admin-mode-pin">Admin PIN</Label>
            <Input
              id="admin-mode-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => { setPin(event.target.value); setError(""); }}
              onKeyDown={(event) => event.key === "Enter" && void submit()}
              autoFocus
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <p className="text-xs text-slate-500">This local PIN prevents accidental access. It is not a replacement for full user authentication.</p>
          <Button className="w-full" disabled={checking} onClick={() => void submit()}>
            {checking ? "Checking..." : "Enter Admin Mode"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
