import type { Table } from "../types/table";

type Props = {
  table: Table;
  onClick: () => void;
};

function TableCard({ table, onClick }: Props) {
  const getStatus = () => {
    switch (table.status) {
      case "single-game":
        return "🟡 Single Game";

      case "double-game":
        return "🟠 Double Game";

      case "time-booking":
        return "🔵 Time Booking";

      default:
        return "🟢 Available";
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: "#222",
        color: "white",
        borderRadius: "15px",
        padding: "20px",
        cursor: "pointer",
      }}
    >
      <h2>{table.name}</h2>

      <p>{getStatus()}</p>

      {table.sessionId && (
        <>
          <hr />

          <p>Session</p>

          <strong>{table.sessionId}</strong>
        </>
      )}
    </div>
  );
}

export default TableCard;