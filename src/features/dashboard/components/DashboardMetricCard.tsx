import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type DashboardMetricCardProps = {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: string;
  iconBackground: string;
  supportingText?: string;
  details?: Array<{ label: string; value: string }>;
  onClick?: () => void;
};

export function DashboardMetricCard({ title, value, icon: Icon, tone, iconBackground, supportingText, details, onClick }: DashboardMetricCardProps) {
  return (
    <Card className={`flex h-full min-h-[184px] flex-col rounded-lg border-slate-200 bg-white p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 dark:border-slate-700 dark:bg-slate-900 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") onClick(); } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBackground} ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {details ? <div className="mt-auto space-y-0.5 pt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{details.map((detail) => <div key={detail.label} className="flex justify-between gap-2"><span>{detail.label}</span><span className="font-semibold text-slate-800 dark:text-slate-200">{detail.value}</span></div>)}</div> : supportingText ? <p className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">{supportingText}</p> : null}
    </Card>
  );
}
