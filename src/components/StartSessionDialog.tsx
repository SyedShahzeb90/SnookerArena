import type { Table } from "../types/table";

type Props = {
  table: Table;
  onClose: () => void;
  onStartSingle: () => void;
  onStartDouble: () => void;
  onStartTime: () => void;
};

function StartSessionDialog({
  table,
  onClose,
  onStartSingle,
  onStartDouble,
  onStartTime,
}: Props) {
  const isPrivateRoom = table.type === "private-room";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: "white",
          width: "450px",
          borderRadius: "12px",
          padding: "25px",
        }}
      >
        <h2>{table.name}</h2>

        <hr />

        {!isPrivateRoom && (
          <>
            <button
              style={{ width: "100%", marginTop: "15px", padding: "12px" }}
              onClick={onStartSingle}
            >
              🎱 Single Game (Rs.300)
            </button>

            <button
              style={{ width: "100%", marginTop: "10px", padding: "12px" }}
              onClick={onStartDouble}
            >
              🎱 Double Game (Rs.600)
            </button>
          </>
        )}

        <button
          style={{ width: "100%", marginTop: "10px", padding: "12px" }}
          onClick={onStartTime}
        >
          ⏱ {isPrivateRoom ? "Private Room (Rs.25/min)" : "Time Booking (Rs.20/min)"}
        </button>

        <button
          style={{ width: "100%", marginTop: "20px", padding: "12px" }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default StartSessionDialog;