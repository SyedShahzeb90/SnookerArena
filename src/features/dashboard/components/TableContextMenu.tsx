import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type TableContextMenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

interface TableContextMenuProps {
  x: number;
  y: number;
  actions: TableContextMenuAction[];
  onClose: () => void;
}

export default function TableContextMenu({
  x,
  y,
  actions,
  onClose,
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeOnScroll = () => onClose();

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [onClose]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "ArrowDown"
      ? (currentIndex + 1) % buttons.length
      : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Table actions"
      onKeyDown={handleKeyDown}
      className="motion-menu-in fixed z-[100] min-w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{
        left: Math.min(x, window.innerWidth - 224),
        top: Math.min(y, window.innerHeight - Math.min(360, actions.length * 40 + 16)),
      }}
    >
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <div key={action.id}>
            {action.destructive && index > 0 && (
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            )}
            <button
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800 ${
                action.destructive
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-700 dark:text-slate-200"
              }`}
              onClick={() => {
                onClose();
                action.onSelect();
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {action.label}
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
