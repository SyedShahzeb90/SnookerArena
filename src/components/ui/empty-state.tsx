import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`motion-fade-in flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 text-center dark:border-slate-700 dark:bg-slate-900/60 ${compact ? "px-4 py-8" : "px-6 py-12"}`}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {actionLabel && <Button size="sm" onClick={onAction}>{actionLabel}</Button>}
          {secondaryActionLabel && <Button size="sm" variant="outline" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>}
        </div>
      )}
    </div>
  );
}
