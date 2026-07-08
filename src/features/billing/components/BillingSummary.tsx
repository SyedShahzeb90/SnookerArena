import { Separator } from "@/components/ui/separator";
import type { Session } from "@/types/session";

interface Props {
  session: Session;
  duration: string;
}

function BillingSummary({
  session,
  duration,
}: Props) {
  return (
    <div className="space-y-4">

      <div>
        <h3 className="text-lg font-semibold">
          Session Details
        </h3>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">

        <div>
          <p className="text-sm text-muted-foreground">
            Player 1
          </p>

          <p className="font-semibold">
            {session.player1 || "-"}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Player 2
          </p>

          <p className="font-semibold">
            {session.player2 || "-"}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Session
          </p>

          <p className="font-semibold capitalize">
            {session.sessionType}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Duration
          </p>

          <p className="font-semibold">
            {duration}
          </p>
        </div>

      </div>

      <Separator />

      <div className="space-y-2">

        <div className="flex justify-between">
          <span>Game</span>

          <span>
            Rs. {session.gameAmount}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Cafe</span>

          <span>
            Rs. {session.cafeAmount}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Discount</span>

          <span>
            - Rs. {session.discount}
          </span>
        </div>

      </div>

      <Separator />

      <div className="flex justify-between text-xl font-bold">

        <span>Total</span>

        <span>
          Rs. {session.totalAmount}
        </span>

      </div>

    </div>
  );
}

export default BillingSummary;