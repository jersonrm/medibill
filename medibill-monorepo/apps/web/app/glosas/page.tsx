import { redirect } from "next/navigation";
import GestionGlosas from "@/components/glosas/GestionGlosas";
import { obtenerFeaturesUsuario } from "@/lib/suscripcion";

export const metadata = {
  title: "Gestión de Glosas — Medibill",
  description:
    "Glosas recibidas, pendientes, respuestas RS01-RS05 y alertas. Resolución 2284/2023.",
};

export default async function GlosasPage() {
  const feat = await obtenerFeaturesUsuario();
  if (!feat || !feat.features.iaSugerenciasGlosas) {
    redirect("/configuracion/suscripcion?upgrade=glosas");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <GestionGlosas />
    </main>
  );
}
