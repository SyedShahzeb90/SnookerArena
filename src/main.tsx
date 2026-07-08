import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./app/App";

import BillingProvider from "@/features/billing/BillingProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BillingProvider>
      <App />
    </BillingProvider>
  </StrictMode>
);