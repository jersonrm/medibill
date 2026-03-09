"use client";

interface ContactFormProps {
  className?: string;
}

export function ContactForm({ className = "" }: ContactFormProps) {
  return (
    <form
      action={`mailto:soporte@medibill.co`}
      method="GET"
      encType="text/plain"
      className={className}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="nombre"
            className="mb-1.5 block text-sm font-medium text-medi-dark"
          >
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-medi-primary focus:outline-none focus:ring-1 focus:ring-medi-primary"
            placeholder="Tu nombre"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-medi-dark"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-medi-primary focus:outline-none focus:ring-1 focus:ring-medi-primary"
            placeholder="tu@email.com"
          />
        </div>
      </div>
      <div className="mt-4">
        <label
          htmlFor="mensaje"
          className="mb-1.5 block text-sm font-medium text-medi-dark"
        >
          Mensaje
        </label>
        <textarea
          id="mensaje"
          name="body"
          rows={4}
          required
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-medi-primary focus:outline-none focus:ring-1 focus:ring-medi-primary"
          placeholder="¿En qué podemos ayudarte?"
        />
      </div>
      <button
        type="submit"
        className="mt-6 w-full rounded-xl bg-medi-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-medi-accent sm:w-auto"
      >
        Enviar Mensaje
      </button>
    </form>
  );
}
