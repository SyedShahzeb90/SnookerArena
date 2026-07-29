import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageWidth = "standard" | "wide" | "compact";

const pageWidths: Record<PageWidth, string> = {
  standard: "max-w-7xl",
  wide: "max-w-[1500px]",
  compact: "max-w-5xl",
};

export function PageShell({
  children,
  className,
  contentClassName,
  width = "standard",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: PageWidth;
}) {
  return (
    <main
      className={cn(
        "min-h-full bg-slate-100 px-4 py-5 dark:bg-slate-950 sm:px-5 sm:py-6 lg:px-6 lg:py-6",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto w-full space-y-5 lg:space-y-6",
          pageWidths[width],
          contentClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}

export function PageHeading({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-slate-50">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function PageBanner({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </section>
  );
}
