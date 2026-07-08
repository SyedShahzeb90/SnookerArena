import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PaymentMethod } from "@/types/session";

interface Props {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}

function PaymentMethodSelector({
  value,
  onChange,
}: Props) {
  return (
    <div className="space-y-2">

      <label className="text-sm font-medium">
        Payment Method
      </label>

      <Select
        value={value}
        onValueChange={(value) =>
          onChange(value as PaymentMethod)
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>

          <SelectItem value="cash">
            Cash
          </SelectItem>

          <SelectItem value="card">
            Card
          </SelectItem>

          <SelectItem value="jazzcash">
            JazzCash
          </SelectItem>

          <SelectItem value="easypaisa">
            Easypaisa
          </SelectItem>

        </SelectContent>
      </Select>

    </div>
  );
}

export default PaymentMethodSelector;