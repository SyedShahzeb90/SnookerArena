import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
} from "react-router-dom";

import {
  BusinessDayPage,
  OperatorLandingRedirect,
  TablesRoomsPage,
} from "@/features/dashboard/Dashboard";
import CafePage from "@/features/cafe/CafePage";
import AccessoriesPage from "@/features/accessories/AccessoriesPage";
import SalesHistoryPage from "@/features/sales/pages/SalesHistoryPage";
import ExpensesPage from "@/features/expenses/pages/ExpensesPage";
import CheckoutPage from "@/features/billing/pages/CheckoutPage";
import ProfitLossPage from "@/features/reports/pages/ProfitLossPage";
import AdminDashboard from "@/features/admin/AdminDashboard";
import MenuManagementPage from "@/features/admin/MenuManagementPage";
import TableHistoryPage from "@/features/table-history/pages/TableHistoryPage";
import DayHistoryPage from "@/features/business-day/pages/DayHistoryPage";
import DeveloperToolsPage from "@/features/admin/DeveloperToolsPage";
import CustomerBillsPage from "@/features/customers/pages/CustomerBillsPage";
import CreditLedgerPage from "@/features/credit-ledger/pages/CreditLedgerPage";
import OperatorShell from "@/features/dashboard/components/OperatorShell";
import BackupRestorePage from "@/features/backup/pages/BackupRestorePage";
import ClubSettingsPage from "@/features/settings/pages/ClubSettingsPage";
import GeneralSettingsPage from "@/features/settings/pages/GeneralSettingsPage";
import VendorRestockingPage from "@/features/cafe/pages/VendorRestockingPage";
import CanteenProfitReportPage from "@/features/reports/pages/CanteenProfitReportPage";
import RequirePermission from "@/features/admin-mode/RequirePermission";
import AccessoriesManagementPage from "@/features/accessories/pages/AccessoriesManagementPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/operator" replace />}
        />

        <Route element={<OperatorShell />}>
          <Route path="/operator" element={<OperatorLandingRedirect />} />

          <Route
            path="/operator/business-day"
            element={<BusinessDayPage />}
          />

          <Route
            path="/operator/tables-rooms"
            element={<TablesRoomsPage />}
          />

          <Route
            path="/operator/floor-overview"
            element={<Navigate to="/operator/tables-rooms" replace />}
          />

          <Route
            path="/operator/cafe"
            element={<CafePage />}
          />

          <Route
            path="/operator/accessories"
            element={<AccessoriesPage />}
          />

          <Route
            path="/operator/billing"
            element={<CheckoutPage />}
          />

          <Route
            path="/operator/customer-bills"
            element={<CustomerBillsPage />}
          />

          <Route
            path="/operator/credit-ledger"
            element={<CreditLedgerPage />}
          />

          <Route
            path="/operator/expenses"
            element={<RequirePermission permission="view_management_reports"><ExpensesPage /></RequirePermission>}
          />

          <Route
            path="/operator/table-history"
            element={<RequirePermission permission="view_management_reports"><TableHistoryPage /></RequirePermission>}
          />

          <Route
            path="/operator/backup-restore"
            element={<RequirePermission permission="manage_backups"><BackupRestorePage /></RequirePermission>}
          />

          <Route
            path="/operator/club-settings"
            element={<RequirePermission permission="manage_settings" allowPinSetup><ClubSettingsPage /></RequirePermission>}
          />

          <Route
            path="/operator/general-settings"
            element={<RequirePermission permission="manage_settings"><GeneralSettingsPage /></RequirePermission>}
          />

          <Route
            path="/operator/day-history"
            element={<DayHistoryPage />}
          />

          <Route
            path="/admin"
            element={<RequirePermission permission="view_management_reports"><AdminDashboard /></RequirePermission>}
          />

          <Route
            path="/admin/sales"
            element={<RequirePermission permission="view_management_reports"><SalesHistoryPage /></RequirePermission>}
          />

          <Route
            path="/admin/customer-bills"
            element={<RequirePermission permission="view_management_reports"><CustomerBillsPage /></RequirePermission>}
          />

          <Route
            path="/admin/profit-loss"
            element={<RequirePermission permission="view_management_reports"><ProfitLossPage /></RequirePermission>}
          />

          <Route
            path="/admin/canteen-profit"
            element={<RequirePermission permission="view_management_reports"><CanteenProfitReportPage /></RequirePermission>}
          />

          <Route
            path="/admin/expenses"
            element={<RequirePermission permission="view_management_reports"><ExpensesPage /></RequirePermission>}
          />

          <Route
            path="/admin/menu"
            element={<RequirePermission permission="manage_canteen"><MenuManagementPage /></RequirePermission>}
          />

          <Route
            path="/admin/menu/vendor-restocking"
            element={<RequirePermission permission="manage_vendor_restocking"><VendorRestockingPage /></RequirePermission>}
          />

          <Route
            path="/admin/accessories"
            element={<RequirePermission permission="manage_inventory"><AccessoriesManagementPage /></RequirePermission>}
          />

          <Route
            path="/admin/table-history"
            element={<RequirePermission permission="view_management_reports"><TableHistoryPage /></RequirePermission>}
          />

          <Route
            path="/admin/day-history"
            element={<RequirePermission permission="view_management_reports"><DayHistoryPage /></RequirePermission>}
          />

          <Route
            path="/admin/developer-tools"
            element={<RequirePermission permission="manage_settings"><DeveloperToolsPage /></RequirePermission>}
          />
        </Route>

        <Route
          path="/cafe"
          element={<Navigate to="/operator/cafe" replace />}
        />

        <Route
          path="/sales"
          element={<Navigate to="/admin/sales" replace />}
        />

        <Route
          path="/expenses"
          element={<Navigate to="/operator/expenses" replace />}
        />

        <Route
          path="/checkout"
          element={<Navigate to="/operator/billing" replace />}
        />

        <Route
          path="/reports/profit-loss"
          element={<Navigate to="/admin/profit-loss" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
