type ProgressIndicatorProps = {
  label: string;
  current: number;
  maximum: number;
  supportingText: string;
  status?: string;
};

export function ProgressIndicator({ label, current, maximum, supportingText, status }: ProgressIndicatorProps) {
  const percentage = maximum > 0 ? Math.min(100, Math.max(0, (current / maximum) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={current}>
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percentage}%` }} />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{supportingText}{status ? ` · ${status}` : ""}</p>
    </div>
  );
}
