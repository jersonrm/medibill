import DashboardGlosas from "@/components/DashboardGlosas";

export const metadata = {
  title: "Dashboard de Glosas — Medibill",
  description:
    "Panel de seguimiento del ciclo de glosas y devoluciones. Resolución 2284/2023.",
};

export default function DashboardGlosasPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <DashboardGlosas />
    </main>
  );
}
