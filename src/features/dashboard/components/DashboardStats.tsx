import { Card } from "@/components/ui/card";
import { useTableStore } from "@/store/tableStore";

function DashboardStats() {
  const tables = useTableStore((state) => state.tables);

  const total = tables.length;

  const available = tables.filter(
    (t) => t.status === "available"
  ).length;

  const running = tables.filter(
    (t) => t.status === "running"
  ).length;

  return (
    <section className="grid grid-cols-3 gap-6">

      <Card className="p-6">
        <h3 className="text-lg font-semibold">
          Total Tables
        </h3>

        <p className="mt-3 text-4xl font-bold">
          {total}
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold">
          Running
        </h3>

        <p className="mt-3 text-4xl font-bold text-red-600">
          {running}
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold">
          Available
        </h3>

        <p className="mt-3 text-4xl font-bold text-green-600">
          {available}
        </p>
      </Card>

    </section>
  );
}

export default DashboardStats;