import examplesFile from "@/data/examples.json";
import type { Example, Problem, SolveResponse } from "./contract";

export const examples = (examplesFile as unknown as { examples: Example[] }).examples;

/** El servidor de cálculo no respondió. En la demostración ocurre con todo problema no guardado. */
export class BackendUnavailableError extends Error {
  constructor() {
    super("No se pudo conectar con el servidor de cálculo.");
    this.name = "BackendUnavailableError";
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

/**
 * Punto único de acceso al cálculo. Cuando exista el backend, este cuerpo se
 * reemplaza por el POST a la API REST y el resto de la interfaz no cambia.
 */
export async function solveProblem(problem: Problem): Promise<SolveResponse> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const match = examples.find((example) => sameProblem(example.problem, problem));
  if (!match) throw new BackendUnavailableError();
  return match.response;
}
