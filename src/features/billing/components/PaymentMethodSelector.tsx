import { useEffect } from "react";

import type { PaymentMethod } from "@/types/session";
import type { PaymentSplit } from "@/features/sales/types/sale";

interface Props {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  totalAmount?: number;
  splits?: PaymentSplit[];
  onSplitsChange?: (splits: PaymentSplit[]) => void;
}

const paymentOptions: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
];

function getFirstUnusedMethod(
  splits: PaymentSplit[],
  fallback: PaymentMethod = "cash"
) {
  return (
    paymentOptions.find(
      (option) =>
        !splits.some(
          (split) => split.method === option.value
        )
    )?.value ?? fallback
  );
}

function normalizeSplitMethods(
  splits: PaymentSplit[]
) {
  const used = new Set<PaymentMethod>();

  return splits.map((split) => {
    if (!used.has(split.method)) {
      used.add(split.method);
      return split;
    }

    const nextMethod =
      paymentOptions.find(
        (option) => !used.has(option.value)
      )?.value ?? split.method;

    used.add(nextMethod);
    return {
      ...split,
      method: nextMethod,
    };
  });
}

function PaymentMethodSelector({
  value,
  onChange,
  totalAmount,
  splits = [],
  onSplitsChange,
}: Props) {
  const isSplitPayment =
    Boolean(onSplitsChange) &&
    totalAmount !== undefined &&
    splits.length > 0;
  const splitTotal = splits.reduce(
    (total, split) => total + split.amount,
    0
  );
  const remaining =
    totalAmount === undefined
      ? 0
      : totalAmount - splitTotal;

  useEffect(() => {
    if (!onSplitsChange || splits.length < 2) {
      return;
    }

    const normalized =
      normalizeSplitMethods(splits);
    const changed = normalized.some(
      (split, index) =>
        split.method !== splits[index].method
    );

    if (changed) {
      onSplitsChange(normalized);
    }
  }, [onSplitsChange, splits]);

  const updateSplit = (
    index: number,
    split: PaymentSplit
  ) => {
    const nextSplits = normalizeSplitMethods(
      splits.map((item, currentIndex) =>
        currentIndex === index ? split : item
      )
    );

    if (
      totalAmount !== undefined &&
      nextSplits.length >= 2
    ) {
      const otherIndexes = nextSplits
        .map((_, currentIndex) => currentIndex)
        .filter(
          (currentIndex) => currentIndex !== index
        );
      const autofillIndex =
        otherIndexes.find(
          (currentIndex) =>
            nextSplits[currentIndex].amount === 0
        ) ??
        otherIndexes[otherIndexes.length - 1];
      const fixedOtherTotal = otherIndexes
        .filter(
          (currentIndex) =>
            currentIndex !== autofillIndex
        )
        .reduce(
          (total, currentIndex) =>
            total + nextSplits[currentIndex].amount,
          0
        );
      const remainingAmount = Math.max(
        0,
        totalAmount - split.amount - fixedOtherTotal
      );

      nextSplits[autofillIndex] = {
        ...nextSplits[autofillIndex],
        amount: remainingAmount,
      };
    }

    onSplitsChange?.(nextSplits);
  };

  return (
    <div className="space-y-2">
      {!isSplitPayment && (
        <select
          id="payment-method"
          name="paymentMethod"
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value as PaymentMethod
            )
          }
          className="w-full rounded-md border p-2"
        >
          {paymentOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}

      {onSplitsChange && totalAmount !== undefined && (
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">
              Split Payment
            </p>
            <button
              type="button"
              className="text-sm font-semibold text-slate-950 underline"
              onClick={() =>
                onSplitsChange(
                  splits.length > 0
                    ? []
                    : [
                        {
                          method: value,
                          amount: totalAmount,
                        },
                      ]
                )
              }
            >
              {splits.length > 0
                ? "Remove split"
                : "Use split"}
            </button>
          </div>

          {splits.length > 0 && (
            <div className="space-y-2">
              {splits.map((split, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_110px_32px] gap-2"
                >
                  <select
                    id={`payment-split-method-${index}`}
                    name={`paymentSplitMethod${index}`}
                    className="rounded-md border bg-white p-2"
                    value={split.method}
                    onChange={(event) =>
                      updateSplit(index, {
                        ...split,
                        method: event.target
                          .value as PaymentMethod,
                      })
                    }
                  >
                    {paymentOptions
                      .filter(
                        (option) =>
                          option.value ===
                            split.method ||
                          !splits.some(
                            (
                              currentSplit,
                              currentIndex
                            ) =>
                              currentIndex !== index &&
                              currentSplit.method ===
                                option.value
                          )
                      )
                      .map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                  </select>

                  <input
                    id={`payment-split-amount-${index}`}
                    name={`paymentSplitAmount${index}`}
                    className="rounded-md border bg-white p-2"
                    type="number"
                    min={0}
                    value={
                      split.amount === 0
                        ? ""
                        : split.amount
                    }
                    onChange={(event) =>
                      updateSplit(index, {
                        ...split,
                        amount:
                          event.target.value === ""
                            ? 0
                            : Number(
                                event.target.value
                              ) || 0,
                      })
                    }
                  />

                  <button
                    type="button"
                    className="rounded-md border bg-white text-slate-600"
                    onClick={() =>
                      onSplitsChange(
                        splits.filter(
                          (_, currentIndex) =>
                            currentIndex !== index
                        )
                      )
                    }
                  >
                    x
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm font-semibold"
                onClick={() =>
                  onSplitsChange([
                    ...splits,
                    {
                      method: getFirstUnusedMethod(
                        splits
                      ),
                      amount: Math.max(
                        0,
                        remaining
                      ),
                    },
                  ])
                }
              >
                Add Payment Method
              </button>

              <p
                className={`text-sm font-medium ${
                  remaining === 0
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                Total Rs. {splitTotal} / Rs. {totalAmount}
                {remaining !== 0
                  ? `, remaining Rs. ${remaining}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PaymentMethodSelector;
