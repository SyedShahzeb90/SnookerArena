import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Edit3, Eye, Trash2 } from "lucide-react";

export type BillContextMenuAction = {
  id: "view" | "payment" | "edit" | "delete";
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

type BillContextMenuProps = {
  x: number;
  y: number;
  actions: BillContextMenuAction[];
  onClose: () => void;
};

const icons = {
  view: Eye,
  payment: CreditCard,
  edit: Edit3,
  delete: Trash2,
};

export function BillContextMenu({ x, y, actions, onClose }: BillContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
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

  const activate = (action: BillContextMenuAction) => {
    onClose();
    action.onSelect();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!actions.length) return;
    const currentIndex = actions.findIndex(
      (action) => action.id === (document.activeElement as HTMLElement)?.dataset.action,
    );
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowDown"
      ? (currentIndex + 1) % actions.length
      : (currentIndex - 1 + actions.length) % actions.length;
    menuRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  };

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Bill actions"
      onKeyDown={handleKeyDown}
      className="motion-menu-in fixed z-[100] min-w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ left: Math.min(x, window.innerWidth - 224), top: Math.min(y, window.innerHeight - Math.min(260, actions.length * 42 + 16)) }}
    >
      {actions.map((action, index) => {
        const Icon = icons[action.id];
        return (
          <div key={action.id}>
            {action.destructive && index > 0 && <div className="my-1 border-t border-slate-100 dark:border-slate-800" />}
            <button
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              role="menuitem"
              data-action={action.id}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none transition focus:bg-slate-100 hover:bg-slate-100 dark:focus:bg-slate-800 dark:hover:bg-slate-800 ${action.destructive ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}
              onClick={() => activate(action)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {action.label}
            </button>
          </div>
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}
