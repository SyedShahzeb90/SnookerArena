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
      <label className="font-medium">
        Payment Method
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as PaymentMethod
          )
        }
        className="w-full rounded-md border p-2"
      >
        <option value="cash">
          Cash
        </option>

        <option value="card">
          Card
        </option>

        <option value="jazzcash">
          JazzCash
        </option>

        <option value="easypaisa">
          Easypaisa
        </option>
      </select>
    </div>
  );
}

export default PaymentMethodSelector;