import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./app/App";

import BillingProvider from "@/features/billing/BillingProvider";
import { ToastProvider } from "@/components/ui/toast";
import {
  initializeInterfaceScale,
  InterfaceScaleProvider,
  DisplayDensityProvider,
} from "@/features/settings/interfaceScale";
import {
  initializeTheme,
  ThemeProvider,
} from "@/features/theme/ThemeProvider";

initializeTheme();
initializeInterfaceScale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <InterfaceScaleProvider>
        <DisplayDensityProvider>
          <ToastProvider>
          <BillingProvider>
            <App />
          </BillingProvider>
          </ToastProvider>
        </DisplayDensityProvider>
      </InterfaceScaleProvider>
    </ThemeProvider>
  </StrictMode>
);
