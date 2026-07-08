import type { Session } from "@/types/session";

interface Props {
  session: Session;
}

function TableInfo({ session }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">
          Players
        </p>

        <p className="font-semibold">
          {session.player1 || "-"}
        </p>

        {session.player2 && (
          <p className="font-semibold">
            {session.player2}
          </p>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Session Type
        </p>

        <p className="font-semibold capitalize">
          {session.sessionType}
        </p>
      </div>

      <div>
        <p className="text-sm text-gray-500">
          Started
        </p>

        <p className="font-semibold">
          {new Date(session.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export default TableInfo;