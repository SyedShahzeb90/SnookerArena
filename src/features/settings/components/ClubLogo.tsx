import { Trophy } from "lucide-react";

import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

export type LogoFitMode = "contain" | "cover" | "fill";
type LogoSize = "header" | "preview";

interface ClubLogoProps {
  alt?: string;
  className?: string;
  fit?: LogoFitMode;
  size?: LogoSize;
  src?: string;
}

const fitClasses: Record<LogoFitMode, string> = {
  contain: "object-contain",
  cover: "object-cover",
  fill: "object-fill",
};

const defaultLogoSizeClasses: Record<LogoSize, string> = {
  header: "h-14 w-14",
  preview: "h-16 w-16",
};

const customLogoSizeClasses: Record<LogoSize, Record<LogoFitMode, string>> = {
  header: {
    contain: "h-14 w-auto max-w-[120px] lg:h-16 lg:max-w-[140px]",
    cover: "h-14 w-[120px] lg:h-16 lg:w-[140px]",
    fill: "h-14 w-[120px] lg:h-16 lg:w-[140px]",
  },
  preview: {
    contain: "h-16 w-auto max-w-[140px]",
    cover: "h-16 w-[140px]",
    fill: "h-16 w-[140px]",
  },
};

const iconSizeClasses: Record<LogoSize, string> = {
  header: "h-7 w-7",
  preview: "h-8 w-8",
};

export function ClubLogo({
  alt,
  className = "",
  fit,
  size = "header",
  src,
}: ClubLogoProps) {
  const settingsLogo = useClubSettingsStore(
    (state) => state.settings.customLogoDataUrl,
  );
  const settingsFit = useClubSettingsStore(
    (state) => state.settings.customLogoFit,
  );
  const clubName = useClubSettingsStore((state) => state.settings.clubName);
  const logoSrc = src ?? settingsLogo;
  const logoFit = fit ?? settingsFit ?? "contain";

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={alt ?? `${clubName} logo`}
        className={`block shrink-0 ${customLogoSizeClasses[size][logoFit]} ${fitClasses[logoFit]} ${className}`}
        style={{ imageRendering: "auto" }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-950 text-white ${defaultLogoSizeClasses[size]} ${className}`}
    >
      <Trophy className={iconSizeClasses[size]} aria-hidden="true" />
    </div>
  );
}
