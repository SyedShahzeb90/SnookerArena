import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

type ProgressIndicatorProps = {
  label: string;
  current: number;
  maximum: number;
  supportingText: string;
  status?: string;
  animate?: boolean;
};

export function ProgressIndicator({
  label,
  current,
  maximum,
  supportingText,
  status,
  animate = false,
}: ProgressIndicatorProps) {
  const percentage =
    maximum > 0
      ? Math.min(100, Math.max(0, (current / maximum) * 100))
      : 0;
  const animatedPercentage = useAnimatedNumber(percentage, animate ? 300 : 0);
  const displayedPercentage = animate ? animatedPercentage : percentage;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {Math.round(displayedPercentage)}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={current}
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${displayedPercentage}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {supportingText}
        {status ? ` · ${status}` : ""}
      </p>
    </div>
  );
}
