import DesdeTelegramClient from "./DesdeTelegramClient";

/**
 * Página de deep link desde el Bot de Telegram.
 * Carga la clasificación pendiente y pre-llena los datos del paciente.
 */
export default async function DesdeTelegramPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Token no proporcionado</h1>
          <p className="mt-2 text-gray-600">Este enlace no es válido. Generá uno nuevo desde el Bot de Telegram.</p>
        </div>
      </div>
    );
  }

  return <DesdeTelegramClient token={token} />;
}
