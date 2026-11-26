import type { Problem, Relation, Sense } from "./contract";

export const MAX_DIMENSION = 20;

export interface ConstraintDraft {
  coefficients: string[];
  relation: Relation;
  rhs: string;
}

export interface ProblemDraft {
  sense: Sense;
  nText: string;
  mText: string;
  objective: string[];
  constraints: ConstraintDraft[];
}

export interface ValidationIssue {
  field: string;
  message: string;
}

const NUMBER_PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!NUMBER_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function parseDimension(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= MAX_DIMENSION ? value : null;
}

function checkCell(text: string, field: string, label: string, issues: ValidationIssue[]) {
  if (text.trim() === "") {
    issues.push({ field, message: `Falta ${label}.` });
  } else if (parseNumber(text) === null) {
    issues.push({ field, message: `${label[0].toUpperCase()}${label.slice(1)} no es un número: «${text.trim()}».` });
  }
}

export function validateDraft(draft: ProblemDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const n = parseDimension(draft.nText);
  const m = parseDimension(draft.mText);
  if (n === null) {
    issues.push({ field: "n", message: `El número de variables debe ser un entero entre 1 y ${MAX_DIMENSION}.` });
  }
  if (m === null) {
    issues.push({ field: "m", message: `El número de restricciones debe ser un entero entre 1 y ${MAX_DIMENSION}.` });
  }
  if (n !== null && draft.objective.length !== n) {
    issues.push({ field: "n", message: `La función objetivo tiene ${draft.objective.length} coeficientes, pero se indicaron ${n} variables.` });
  }
  if (m !== null && draft.constraints.length !== m) {
    issues.push({ field: "m", message: `Hay ${draft.constraints.length} restricciones escritas, pero se indicaron ${m}.` });
  }
  draft.objective.forEach((text, j) => {
    checkCell(text, `c-${j}`, `el coeficiente de x${j + 1} en la función objetivo`, issues);
  });
  draft.constraints.forEach((constraint, i) => {
    if (n !== null && constraint.coefficients.length !== n) {
      issues.push({ field: `b-${i}`, message: `La restricción ${i + 1} tiene ${constraint.coefficients.length} coeficientes, pero se indicaron ${n} variables.` });
    }
    constraint.coefficients.forEach((text, j) => {
      checkCell(text, `a-${i}-${j}`, `el coeficiente de x${j + 1} en la restricción ${i + 1}`, issues);
    });
    checkCell(constraint.rhs, `b-${i}`, `el lado derecho de la restricción ${i + 1}`, issues);
  });
  return issues;
}

/** Convierte un borrador ya validado en el problema que se envía al servidor. */
export function draftToProblem(draft: ProblemDraft): Problem {
  const read = (text: string) => parseNumber(text) as number;
  return {
    sense: draft.sense,
    objective: draft.objective.map(read),
    constraints: draft.constraints.map((constraint) => ({
      coefficients: constraint.coefficients.map(read),
      relation: constraint.relation,
      rhs: read(constraint.rhs),
    })),
  };
}

const numberToText = (value: number) => String(value).replace(".", ",");

export function problemToDraft(problem: Problem): ProblemDraft {
  return {
    sense: problem.sense,
    nText: String(problem.objective.length),
    mText: String(problem.constraints.length),
    objective: problem.objective.map(numberToText),
    constraints: problem.constraints.map((constraint) => ({
      coefficients: constraint.coefficients.map(numberToText),
      relation: constraint.relation,
      rhs: numberToText(constraint.rhs),
    })),
  };
}

export function resizeDraft(draft: ProblemDraft, n: number, m: number): ProblemDraft {
  const fit = (values: string[]) => Array.from({ length: n }, (_, j) => values[j] ?? "");
  return {
    ...draft,
    objective: fit(draft.objective),
    constraints: Array.from({ length: m }, (_, i) => {
      const current = draft.constraints[i];
      return {
        coefficients: fit(current?.coefficients ?? []),
        relation: current?.relation ?? "<=",
        rhs: current?.rhs ?? "",
      };
    }),
  };
}

export function emptyDraft(n: number, m: number, sense: Sense = "max"): ProblemDraft {
  return resizeDraft(
    { sense, nText: String(n), mText: String(m), objective: [], constraints: [] },
    n,
    m,
  );
}
