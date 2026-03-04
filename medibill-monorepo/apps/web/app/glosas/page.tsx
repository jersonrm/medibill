import GestionGlosas from "@/components/glosas/GestionGlosas";

export const metadata = {
  title: "Gestión de Glosas — Medibill",
  description:
    "Glosas recibidas, pendientes, respuestas RS01-RS05 y alertas. Resolución 2284/2023.",
};

export default function GlosasPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <GestionGlosas />
    </main>
  );
}
