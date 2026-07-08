import DashboardHeader from "./components/DashboardHeader";
import DashboardStats from "./components/DashboardStats";
import TableGrid from "./components/TableGrid";

function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-100">
      <DashboardHeader />

      <div className="mx-auto max-w-7xl p-6">
        <DashboardStats />

        <div className="mt-8">
          <TableGrid />
        </div>
      </div>
    </main>
  );
}

export default Dashboard;