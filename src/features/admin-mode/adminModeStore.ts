import { create } from "zustand";

import { hasPermission, type AppPermission } from "./permissions";

const SESSION_KEY = "snooker-arena-admin-mode";

function readSessionMode() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "unlocked";
  } catch {
    return false;
  }
}

interface AdminModeStore {
  isAdminMode: boolean;
  pinDialogOpen: boolean;
  requestedPath?: string;
  message?: string;
  can: (permission: AppPermission) => boolean;
  requestAdminMode: (requestedPath?: string) => void;
  enterAdminMode: () => void;
  exitAdminMode: (message?: string) => void;
  closePinDialog: () => void;
  clearMessage: () => void;
}

export const useAdminModeStore = create<AdminModeStore>((set, get) => ({
  isAdminMode: readSessionMode(),
  pinDialogOpen: false,
  can: (permission) => hasPermission(get().isAdminMode, permission),
  requestAdminMode: (requestedPath) =>
    set({ pinDialogOpen: true, requestedPath, message: undefined }),
  enterAdminMode: () => {
    sessionStorage.setItem(SESSION_KEY, "unlocked");
    set({ isAdminMode: true, pinDialogOpen: false, message: "Admin Mode enabled." });
  },
  exitAdminMode: (message) => {
    sessionStorage.removeItem(SESSION_KEY);
    set({
      isAdminMode: false,
      pinDialogOpen: false,
      requestedPath: undefined,
      message: message ?? "Returned to Operator Mode.",
    });
  },
  closePinDialog: () => set({ pinDialogOpen: false, requestedPath: undefined }),
  clearMessage: () => set({ message: undefined }),
}));
