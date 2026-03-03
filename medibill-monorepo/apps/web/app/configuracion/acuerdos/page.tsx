import ConfiguracionAcuerdo from "@/components/ConfiguracionAcuerdo";

export const metadata = {
  title: "Acuerdos de Voluntades — Medibill",
  description:
    "Configure contratos IPS ↔ EPS con tarifas pactadas para el validador anti-glosas.",
};

export default function AcuerdosPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <ConfiguracionAcuerdo />
    </main>
  );
}
