import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Dashboard from "@/features/dashboard/Dashboard";
import CafePage from "@/features/cafe/CafePage";
import SalesHistoryPage from "@/features/sales/pages/SalesHistoryPage";
import ExpensesPage from "@/features/expenses/pages/ExpensesPage";
import CheckoutPage from "@/features/billing/pages/CheckoutPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/cafe"
          element={<CafePage />}
        />

        <Route
          path="/sales"
          element={<SalesHistoryPage />}
        />

        <Route
          path="/expenses"
          element={<ExpensesPage />}
        />

        <Route
          path="/checkout"
          element={<CheckoutPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
