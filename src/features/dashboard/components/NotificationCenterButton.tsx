import { Bell, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export default function NotificationCenterButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 bg-slate-50 text-slate-600"
        aria-label="Open notification center"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className="motion-menu-in absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-1 pb-2 dark:border-slate-800">
            <p className="font-bold text-slate-950">Notifications</p>
            <p className="text-xs text-slate-500">Operational alerts will appear here.</p>
          </div>
          <div className="flex flex-col items-center px-4 py-7 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">No new notifications</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Pending payments, timing alerts, and stock reminders can be added here later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
