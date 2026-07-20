import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./app/App";

import BillingProvider from "@/features/billing/BillingProvider";
import {
  initializeTheme,
  ThemeProvider,
} from "@/features/theme/ThemeProvider";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BillingProvider>
        <App />
      </BillingProvider>
    </ThemeProvider>
  </StrictMode>
);
