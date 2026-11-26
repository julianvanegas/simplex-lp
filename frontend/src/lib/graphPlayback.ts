import type { BigMValue, Iteration, Problem, Rational, SolveResponse } from "./contract";
import { isZero, negateBigM } from "./numbers";

export interface PlaybackStep {
  iteration: Iteration;
  x1: Rational;
  x2: Rational;
  /** Valor de Z en la tabla; incluye M mientras haya artificiales positivas. */
  z: BigMValue;
  /** Artificiales básicas con valor positivo: el punto aún no es factible. */
  artificials: string[];
  samePointAsNext: boolean;
}

/** Convierte las iteraciones del Simplex en los puntos que recorre el gráfico. */
export function buildPlaybackSteps(problem: Problem, response: SolveResponse): PlaybackStep[] {
  const artificialNames = new Set(
    response.standardForm.variables
      .filter((variable) => variable.kind === "artificial")
      .map((variable) => variable.name),
  );
  const steps = response.iterations.map((iteration) => {
    const { rows, objectiveRow } = iteration.tableau;
    const valueOf = (name: string) => rows.find((row) => row.basic === name)?.rhs ?? "0";
    return {
      iteration,
      x1: valueOf("x1"),
      x2: valueOf("x2"),
      z: problem.sense === "min" ? negateBigM(objectiveRow.rhs) : objectiveRow.rhs,
      artificials: rows
        .filter((row) => artificialNames.has(row.basic) && !isZero(row.rhs))
        .map((row) => row.basic),
      samePointAsNext: false,
    };
  });
  return steps.map((step, index) => {
    const next = steps[index + 1];
    return { ...step, samePointAsNext: Boolean(next) && next.x1 === step.x1 && next.x2 === step.x2 };
  });
}
