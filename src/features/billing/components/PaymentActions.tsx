import { Button } from "@/components/ui/button";

interface Props {
  onReceivePayment: () => void;
}

function PaymentActions({
  onReceivePayment,
}: Props) {
  return (
    <div className="flex gap-3">
      <Button
        className="h-11 flex-1 text-base"
        onClick={onReceivePayment}
      >
        Generate Bill & Receive Payment
      </Button>
    </div>
  );
}

export default PaymentActions;
