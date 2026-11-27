import type { Constraint, Problem, Relation } from "./contract";
import { MAX_DIMENSION } from "./validation";

/**
 * El archivo guarda el problema con el mismo formato que se envía al servidor
 * (`Problem` de contract.ts), así un archivo también sirve como cuerpo de
 * `POST /api/solve`.
 */
export function serializeProblem(problem: Problem): string {
  return `${JSON.stringify(problem, null, 2)}\n`;
}

export type ParseResult = { ok: true; problem: Problem } | { ok: false; message: string };

const RELATIONS: Relation[] = ["<=", ">=", "="];

class FileFormatError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FileFormatError(`${label} no es un número.`);
  }
  return value;
}

function readList(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new FileFormatError(`Falta ${label} o no es una lista.`);
  return value;
}

function checkSize(count: number, what: string) {
  if (count < 1 || count > MAX_DIMENSION) {
    throw new FileFormatError(`El archivo tiene ${count} ${what}; deben ser entre 1 y ${MAX_DIMENSION}.`);
  }
}

function readProblem(data: unknown): Problem {
  if (!isObject(data)) throw new FileFormatError("El archivo no contiene un problema.");

  if (data.sense !== "max" && data.sense !== "min") {
    throw new FileFormatError("El campo «sense» debe ser \"max\" o \"min\".");
  }

  const objective = readList(data.objective, "la función objetivo («objective»)").map((value, j) =>
    readNumber(value, `El coeficiente de x${j + 1} en la función objetivo`),
  );
  checkSize(objective.length, "variables");

  const rawConstraints = readList(data.constraints, "la lista de restricciones («constraints»)");
  checkSize(rawConstraints.length, "restricciones");

  const constraints: Constraint[] = rawConstraints.map((raw, i) => {
    const where = `la restricción ${i + 1}`;
    if (!isObject(raw)) throw new FileFormatError(`La restricción ${i + 1} no tiene el formato esperado.`);
    const coefficients = readList(raw.coefficients, `los coeficientes de ${where}`).map((value, j) =>
      readNumber(value, `El coeficiente de x${j + 1} en ${where}`),
    );
    if (coefficients.length !== objective.length) {
      throw new FileFormatError(
        `La restricción ${i + 1} tiene ${coefficients.length} coeficientes, pero la función objetivo tiene ${objective.length} variables.`,
      );
    }
    if (!RELATIONS.includes(raw.relation as Relation)) {
      throw new FileFormatError(`La relación de ${where} debe ser "<=", ">=" o "=".`);
    }
    return {
      coefficients,
      relation: raw.relation as Relation,
      rhs: readNumber(raw.rhs, `El lado derecho de ${where}`),
    };
  });

  return { sense: data.sense, objective, constraints };
}

/** Lee el texto de un archivo y devuelve el problema o un mensaje claro de por qué no se pudo. */
export function parseProblemFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "El archivo no es un JSON válido." };
  }
  try {
    return { ok: true, problem: readProblem(data) };
  } catch (error) {
    if (error instanceof FileFormatError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Descarga el problema como archivo .json desde el navegador. */
export function downloadProblem(problem: Problem, fileName: string) {
  const blob = new Blob([serializeProblem(problem)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
