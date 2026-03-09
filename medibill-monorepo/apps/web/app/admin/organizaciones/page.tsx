import Link from "next/link";
import { listarOrganizaciones } from "@/app/actions/admin";

const estadoBadge: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-amber-100 text-amber-700",
  canceled: "bg-red-100 text-red-700",
  past_due: "bg-orange-100 text-orange-700",
  paused: "bg-gray-100 text-gray-600",
  incomplete: "bg-gray-100 text-gray-500",
};

export default async function OrganizacionesPage() {
  const orgs = await listarOrganizaciones();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organizaciones</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Plan</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Usuarios</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Creada</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{org.nombre}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{org.tipo}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{org.plan_id || "—"}</td>
                <td className="px-4 py-3">
                  {org.estado_suscripcion ? (
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoBadge[org.estado_suscripcion] || "bg-gray-100 text-gray-500"}`}>
                      {org.estado_suscripcion}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{org.usuarios_activos}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(org.created_at).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/organizaciones/${org.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No hay organizaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
