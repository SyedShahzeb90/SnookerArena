import { Button } from "@/components/ui/button";

interface Props {
  total: number;
  onReceivePayment: () => void;
}

function PaymentFooter({
  total,
  onReceivePayment,
}: Props) {
  return (
    <div className="space-y-4">

      <div className="rounded-lg bg-slate-100 p-4">

        <div className="flex items-center justify-between">

          <span className="text-lg font-semibold">
            Grand Total
          </span>

          <span className="text-2xl font-bold">
            Rs. {total}
          </span>

        </div>

      </div>

      <Button
        className="w-full h-11 text-base"
        onClick={onReceivePayment}
      >
        Receive Payment
      </Button>

    </div>
  );
}

export default PaymentFooter;