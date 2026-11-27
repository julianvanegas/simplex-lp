import examplesFile from "@/data/examples.json";
import type { Example, Problem, SolveResponse } from "./contract";

export const examples = (examplesFile as unknown as { examples: Example[] }).examples;

/** Dirección del backend. En producción se define NEXT_PUBLIC_API_URL al compilar. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Un servidor gratuito dormido puede tardar casi un minuto en despertar. */
const TIMEOUT_MS = 60_000;

export type SolveErrorKind =
  | "unavailable" // no hubo respuesta: servidor apagado, sin red o tiempo agotado
  | "not-ready" // 501: el servidor responde pero el motor aún no está implementado
  | "invalid" // 422: el servidor rechazó el problema
  | "server"; // cualquier otro error del servidor

/** El cálculo no se pudo hacer. `message` trae el detalle del servidor cuando lo hay. */
export class SolveError extends Error {
  constructor(
    readonly kind: SolveErrorKind,
    message = "",
  ) {
    super(message);
    this.name = "SolveError";
  }
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function sameProblem(a: Problem, b: Problem): boolean {
  return (
    a.sense === b.sense &&
    sameNumbers(a.objective, b.objective) &&
    a.constraints.length === b.constraints.length &&
    a.constraints.every((constraint, i) => {
      const other = b.constraints[i];
      return (
        constraint.relation === other.relation &&
        constraint.rhs === other.rhs &&
        sameNumbers(constraint.coefficients, other.coefficients)
      );
    })
  );
}

/** Respuesta guardada para un ejemplo idéntico al problema, si existe. */
export function storedResponse(problem: Problem): SolveResponse | null {
  return examples.find((example) => sameProblem(example.problem, problem))?.response ?? null;
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : "";
  } catch {
    return "";
  }
}

/**
 * Punto único de acceso al cálculo: envía el problema a `POST /api/solve`.
 *
 * Mientras el motor no exista (501) o el servidor no responda, los problemas
 * que coinciden con un ejemplo guardado se siguen mostrando con su respuesta
 * guardada, para que la aplicación se pueda usar y presentar.
 */
export async function solveProblem(problem: Problem): Promise<SolveResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(problem),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    const stored = storedResponse(problem);
    if (stored) return stored;
    throw new SolveError("unavailable");
  }

  if (response.ok) return (await response.json()) as SolveResponse;

  const detail = await readDetail(response);
  if (response.status === 501) {
    const stored = storedResponse(problem);
    if (stored) return stored;
    throw new SolveError("not-ready", detail);
  }
  if (response.status === 422) throw new SolveError("invalid", detail);
  throw new SolveError("server", detail);
}
