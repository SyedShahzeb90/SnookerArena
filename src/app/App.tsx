import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Dashboard from "@/features/dashboard/Dashboard";
import CafePage from "@/features/cafe/CafePage";

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;