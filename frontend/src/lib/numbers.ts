import type { BigMValue, Rational } from "./contract";

export type NumberFormat = "fraction" | "decimal";

const MINUS = "−";

export function toNumber(value: Rational): number {
  const [p, q = "1"] = value.split("/");
  return Number(p) / Number(q);
}

export function isZero(value: Rational): boolean {
  return toNumber(value) === 0;
}

export function negate(value: Rational): Rational {
  if (isZero(value)) return "0";
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

export function formatDecimal(value: number, maxDigits = 4): string {
  const text = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: maxDigits,
    useGrouping: false,
  }).format(value);
  const clean = text.replace("-", MINUS);
  return /^−0(,0*)?$/.test(clean) ? "0" : clean;
}

export function formatRational(value: Rational, format: NumberFormat): string {
  if (format === "decimal") return formatDecimal(toNumber(value));
  return value.replace("-", MINUS);
}

function formatMTerm(m: Rational, format: NumberFormat): string {
  if (m === "1") return "M";
  if (m === "-1") return `${MINUS}M`;
  const text = formatRational(m, format);
  return format === "fraction" && m.includes("/") ? `${text} M` : `${text}M`;
}

export function formatBigM(value: BigMValue, format: NumberFormat): string {
  const hasM = !isZero(value.m);
  const hasC = !isZero(value.c);
  if (!hasM) return formatRational(value.c, format);
  const mText = formatMTerm(value.m, format);
  if (!hasC) return mText;
  const negative = value.c.startsWith("-");
  const cText = formatRational(negative ? negate(value.c) : value.c, format);
  return `${mText} ${negative ? MINUS : "+"} ${cText}`;
}

export function negateBigM(value: BigMValue): BigMValue {
  return { c: negate(value.c), m: negate(value.m) };
}

/** Formato del informe de sensibilidad de Solver: decimales y 1E+30 si no hay límite. */
export function formatSolver(value: Rational | null): string {
  return value === null ? "1E+30" : formatDecimal(toNumber(value), 6);
}
