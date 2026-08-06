export type AppPermission =
  | "manage_settings"
  | "manage_operators"
  | "manage_canteen"
  | "manage_inventory"
  | "manage_vendor_restocking"
  | "manage_payroll"
  | "view_management_reports"
  | "manage_backups"
  | "correct_payments"
  | "cancel_bills";

const adminPermissions = new Set<AppPermission>([
  "manage_settings",
  "manage_operators",
  "manage_canteen",
  "manage_inventory",
  "manage_vendor_restocking",
  "manage_payroll",
  "view_management_reports",
  "manage_backups",
  "correct_payments",
  "cancel_bills",
]);

export function hasPermission(isAdminMode: boolean, permission: AppPermission) {
  return isAdminMode && adminPermissions.has(permission);
}
