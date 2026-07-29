import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-layout";
import OutsidePurchasesPanel from "../components/OutsidePurchasesPanel";

function OutsidePurchasesPage() {
  const navigate = useNavigate();

  return (
    <PageShell contentClassName="space-y-0">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="mb-3 gap-2"
          onClick={() => navigate("/operator/customer-bills")}
        >
          <ArrowLeft className="h-4 w-4" />
          Customer Bills
        </Button>

        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-700">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Customer Outside Purchases
            </h1>
            <p className="text-sm text-slate-500">
              Track purchases paid for customers and record their reimbursements.
            </p>
          </div>
        </div>

        <OutsidePurchasesPanel />
      </div>
    </PageShell>
  );
}

export default OutsidePurchasesPage;
