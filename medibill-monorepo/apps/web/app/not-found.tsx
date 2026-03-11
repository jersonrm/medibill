import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-gray-50">
      <h1 className="text-6xl font-bold text-medi-primary mb-4">404</h1>
      <h2 className="text-xl font-semibold text-medi-deep mb-2">Página no encontrada</h2>
      <p className="text-sm text-medi-dark/60 mb-8 max-w-md">
        La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-2.5 text-sm font-bold text-white bg-medi-primary rounded-lg hover:bg-medi-accent transition-all"
      >
        Ir al dashboard
      </Link>
    </div>
  );
}
