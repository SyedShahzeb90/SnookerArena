export function generateInvoiceNumber(
  sequence: number
) {
  return `INV-${String(sequence).padStart(
    6,
    "0"
  )}`;
}
