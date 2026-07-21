import { useClubSettingsStore } from "@/features/settings/store/clubSettingsStore";

export function generateInvoiceNumber(
  sequence: number
) {
  const prefix = useClubSettingsStore.getState().settings.invoicePrefix;
  return `${prefix}-${String(sequence).padStart(
    6,
    "0"
  )}`;
}
