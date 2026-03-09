import { obtenerMetricasGlobales } from "@/app/actions/admin";

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export default async function AdminDashboard() {
  const m = await obtenerMetricasGlobales();

  const cards = [
    { label: "Organizaciones", value: m.totalOrganizaciones, color: "bg-blue-50 text-blue-700" },
    { label: "Activas", value: m.orgActivas, color: "bg-green-50 text-green-700" },
    { label: "En trial", value: m.orgTrial, color: "bg-amber-50 text-amber-700" },
    { label: "Canceladas", value: m.orgCanceladas, color: "bg-red-50 text-red-700" },
    { label: "Revenue estimado/mes", value: formatCOP(m.revenueMensualEstimado), color: "bg-emerald-50 text-emerald-700" },
    { label: "Clasificaciones IA (mes)", value: m.clasificacionesMes, color: "bg-purple-50 text-purple-700" },
    { label: "Facturas DIAN (mes)", value: m.facturasDianMes, color: "bg-indigo-50 text-indigo-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel de Administración</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
