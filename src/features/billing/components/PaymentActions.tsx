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
        className="flex-1"
        onClick={onReceivePayment}
      >
        Receive Payment
      </Button>
    </div>
  );
}

export default PaymentActions;