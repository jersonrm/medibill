/**
 * Supabase mock infrastructure for testing server actions.
 *
 * Provides a chainable query builder that mirrors the Supabase client API
 * so that tests can configure per-table responses declaratively.
 */

import { vi, type Mock } from "vitest";

// =====================================================================
// TYPES
// =====================================================================

type MockResponse = { data: unknown; error: unknown; count?: number };

type MockSupabaseClient = {
  auth: { getUser: Mock };
  from: Mock;
};

type MockSupabaseModule = {
  createClient: Mock;
};

interface TableConfig {
  select: MockResponse;
  insert: MockResponse;
  update: MockResponse;
  upsert: MockResponse;
  delete: MockResponse;
}

export interface MockSupabaseState {
  tables: Record<string, Partial<TableConfig>>;
  user: { id: string; email: string } | null;
  /** Override responses per call sequence — useful for functions that make multiple queries to the same table */
  callSequence: Record<string, MockResponse[]>;
  callCounts: Record<string, number>;
  /** RPC function mock responses */
  rpcResponses: Record<string, MockResponse>;
}

// =====================================================================
// DEFAULT STATE
// =====================================================================

export function crearEstadoMock(): MockSupabaseState {
  return {
    tables: {},
    user: { id: "user-test-123", email: "test@medibill.co" },
    callSequence: {},
    callCounts: {},
    rpcResponses: {},
  };
}

// =====================================================================
// CONFIGURATION HELPERS
// =====================================================================

/** Configure a table's default response for an operation */
export function configurarTabla(
  state: MockSupabaseState,
  tabla: string,
  operacion: keyof TableConfig,
  respuesta: MockResponse
) {
  if (!state.tables[tabla]) state.tables[tabla] = {};
  state.tables[tabla]![operacion] = respuesta;
}

/** Configure a mock response for an RPC function call */
export function configurarRpc(
  state: MockSupabaseState,
  functionName: string,
  respuesta: MockResponse
) {
  state.rpcResponses[functionName] = respuesta;
}

/** Configure sequential responses for a table+operation (for functions making multiple queries to the same table) */
export function configurarSecuencia(
  state: MockSupabaseState,
  tabla: string,
  operacion: keyof TableConfig,
  respuestas: MockResponse[]
) {
  const key = `${tabla}:${operacion}`;
  state.callSequence[key] = respuestas;
  state.callCounts[key] = 0;
}

function obtenerRespuesta(
  state: MockSupabaseState,
  tabla: string,
  operacion: keyof TableConfig
): MockResponse {
  const key = `${tabla}:${operacion}`;
  // Check sequence first
  if (state.callSequence[key]) {
    const idx = state.callCounts[key] || 0;
    state.callCounts[key] = idx + 1;
    const seq = state.callSequence[key]!;
    return seq[Math.min(idx, seq.length - 1)]!;
  }
  // Fallback to table config
  return state.tables[tabla]?.[operacion] || { data: null, error: null };
}

// =====================================================================
// CHAINABLE QUERY BUILDER MOCK
// =====================================================================

function crearQueryBuilder(state: MockSupabaseState, tabla: string, operacion: keyof TableConfig) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select", "eq", "neq", "gt", "gte", "lt", "lte",
    "in", "is", "like", "ilike", "contains", "containedBy",
    "range", "order", "limit", "offset", "match",
    "not", "or", "filter", "textSearch",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods that return the response
  builder.single = vi.fn().mockImplementation(() => obtenerRespuesta(state, tabla, operacion));
  builder.maybeSingle = vi.fn().mockImplementation(() => obtenerRespuesta(state, tabla, operacion));
  builder.then = undefined; // Make it thenable only via single/maybeSingle or direct await

  // Make the builder itself awaitable (for queries without .single())
  const promise = {
    then: (resolve: (v: unknown) => void) => resolve(obtenerRespuesta(state, tabla, operacion)),
  };
  Object.assign(builder, promise);

  return builder;
}

// =====================================================================
// MOCK SUPABASE CLIENT FACTORY
// =====================================================================

export function crearSupabaseMock(state: MockSupabaseState): MockSupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: state.user },
        error: null,
      }),
    },
    rpc: vi.fn().mockImplementation((fnName: string, _params?: unknown) => {
      const resp = state.rpcResponses[fnName] || { data: null, error: null };
      return Promise.resolve(resp);
    }),
    from: vi.fn().mockImplementation((tabla: string) => {
      return {
        select: vi.fn().mockImplementation((_columns?: string, _opts?: unknown) => {
          return crearQueryBuilder(state, tabla, "select");
        }),
        insert: vi.fn().mockImplementation((_data: unknown) => {
          return crearQueryBuilder(state, tabla, "insert");
        }),
        update: vi.fn().mockImplementation((_data: unknown) => {
          return crearQueryBuilder(state, tabla, "update");
        }),
        upsert: vi.fn().mockImplementation((_data: unknown, _opts?: unknown) => {
          return crearQueryBuilder(state, tabla, "upsert");
        }),
        delete: vi.fn().mockImplementation(() => {
          return crearQueryBuilder(state, tabla, "delete");
        }),
      };
    }),
  };
}

// =====================================================================
// vi.mock SETUP
// =====================================================================

/**
 * Call this in a vi.mock() factory to wire up the Supabase mock.
 * Usage:
 *   let mockState: MockSupabaseState;
 *   vi.mock("@/lib/supabase-server", () => setupSupabaseMock(() => mockState));
 *   beforeEach(() => { mockState = crearEstadoMock(); });
 */
export function setupSupabaseMock(getState: () => MockSupabaseState): MockSupabaseModule {
  return {
    createClient: vi.fn().mockImplementation(async () => crearSupabaseMock(getState())),
  };
}
