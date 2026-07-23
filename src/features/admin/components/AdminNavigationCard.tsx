import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AdminNavigationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

export function AdminNavigationCard({
  icon: Icon,
  title,
  description,
  onClick,
}: AdminNavigationCardProps) {
  return (
    <button
      type="button"
      className="group flex min-h-[108px] w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-[transform,border-color,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
      onClick={onClick}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950 dark:text-slate-100">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
    </button>
  );
}
