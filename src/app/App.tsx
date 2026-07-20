import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
} from "react-router-dom";

import OperatorDashboard from "@/features/dashboard/Dashboard";
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/operator" replace />}
        />

        <Route element={<OperatorShell />}>
          <Route path="/operator" element={<OperatorDashboard />} />

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
            element={<ExpensesPage />}
          />

          <Route
            path="/operator/table-history"
            element={<TableHistoryPage />}
          />

          <Route
            path="/operator/day-history"
            element={<DayHistoryPage />}
          />

          <Route
            path="/admin"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/sales"
            element={<SalesHistoryPage />}
          />

          <Route
            path="/admin/customer-bills"
            element={<CustomerBillsPage />}
          />

          <Route
            path="/admin/profit-loss"
            element={<ProfitLossPage />}
          />

          <Route
            path="/admin/expenses"
            element={<ExpensesPage />}
          />

          <Route
            path="/admin/menu"
            element={<MenuManagementPage />}
          />

          <Route
            path="/admin/table-history"
            element={<TableHistoryPage />}
          />

          <Route
            path="/admin/day-history"
            element={<DayHistoryPage />}
          />

          <Route
            path="/admin/developer-tools"
            element={<DeveloperToolsPage />}
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
