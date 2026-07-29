import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AnimatedCollapsibleProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

function AnimatedCollapsible({
  open,
  children,
  className,
  innerClassName,
}: AnimatedCollapsibleProps) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-[transform,opacity] duration-200 ease-out",
            open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
            innerClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export { AnimatedCollapsible };
