import { NextRequest, NextResponse } from "next/server";
import { wompiProvider } from "@/lib/wompi";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/wompi/webhook
 * Recibe eventos de Wompi (transacciones aprobadas, rechazadas, etc.)
 * y actualiza el estado de suscripciones/pagos en la base de datos.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-event-checksum") || "";
  const timestamp = request.headers.get("x-event-timestamp") || "";

  // 1. Verificar firma
  if (!wompiProvider.verificarWebhookFirma({ body, signature, timestamp })) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // 2. Parsear evento
  const evento = wompiProvider.parsearEvento(body);

  // 3. Crear cliente Supabase con service role para operaciones admin
  const supabase = createServiceClient();

  // 4. Procesar según tipo de evento
  switch (evento.tipo) {
    case "transaction.approved": {
      if (!evento.referencia) break;

      // La referencia tiene formato: "sub_{orgId}_{periodo}"
      const parts = evento.referencia.split("_");
      if (parts[0] !== "sub" || parts.length < 3) break;

      const orgId = parts[1];
      const periodo = parts.slice(2).join("_");

      // Verificar si ya procesamos esta transacción (idempotencia)
      const { data: existente } = await supabase
        .from("historial_pagos")
        .select("id")
        .eq("wompi_transaction_id", evento.transactionId)
        .maybeSingle();

      if (existente) break; // Ya procesado, no duplicar cambios de suscripción

      // Activar suscripción
      const ahora = new Date();
      const finPeriodo = new Date(ahora);
      finPeriodo.setMonth(finPeriodo.getMonth() + 1);

      await supabase
        .from("suscripciones")
        .update({
          estado: "active",
          periodo_actual_inicio: ahora.toISOString(),
          periodo_actual_fin: finPeriodo.toISOString(),
          updated_at: ahora.toISOString(),
        })
        .eq("organizacion_id", orgId);

      // Guardar token de pago si viene (para cobros recurrentes)
      if (evento.paymentSourceToken) {
        await supabase
          .from("organizaciones")
          .update({ wompi_payment_source: evento.paymentSourceToken })
          .eq("id", orgId);
      }

      // Registrar pago (idempotente: ignora si ya existe el transaction_id)
      await supabase.from("historial_pagos").upsert(
        {
          organizacion_id: orgId,
          wompi_transaction_id: evento.transactionId,
          monto_cop: evento.montoCop || 0,
          estado: "paid",
          descripcion: `Pago suscripción ${periodo}`,
          periodo,
          fecha_pago: ahora.toISOString(),
          metodo_pago: evento.metodoPago,
        },
        { onConflict: "wompi_transaction_id", ignoreDuplicates: true }
      );

      break;
    }

    case "transaction.declined": {
      if (!evento.referencia) break;
      const parts = evento.referencia.split("_");
      if (parts[0] !== "sub" || parts.length < 3) break;
      const orgId = parts[1];

      // Marcar como past_due
      await supabase
        .from("suscripciones")
        .update({
          estado: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("organizacion_id", orgId);

      // Registrar intento fallido (idempotente: ignora si ya existe el transaction_id)
      await supabase.from("historial_pagos").upsert(
        {
          organizacion_id: orgId,
          wompi_transaction_id: evento.transactionId,
          monto_cop: evento.montoCop || 0,
          estado: "declined",
          descripcion: "Pago rechazado",
          fecha_pago: new Date().toISOString(),
          metodo_pago: evento.metodoPago,
        },
        { onConflict: "wompi_transaction_id", ignoreDuplicates: true }
      );

      break;
    }

    // Otros eventos se ignoran silenciosamente
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
