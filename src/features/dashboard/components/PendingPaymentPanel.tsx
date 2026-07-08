import { Button } from "@/components/ui/button";

interface Props {
  onOpenBill: () => void;
}

function PendingPaymentPanel({
  onOpenBill,
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
      <div>
        <h3 className="font-semibold text-yellow-800">
          Payment Pending
        </h3>

        <p className="mt-1 text-sm text-yellow-700">
          Session ended successfully.
        </p>

        <p className="text-sm text-yellow-700">
          Ready to generate the bill.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={onOpenBill}
      >
        💰 Open Bill
      </Button>
    </div>
  );
}

export default PendingPaymentPanel;