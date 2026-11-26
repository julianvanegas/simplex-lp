import { Fragment } from "react";
import type { Relation } from "@/lib/contract";

export const RELATION_SYMBOL: Record<Relation, string> = { "<=": "≤", ">=": "≥", "=": "=" };

/** Muestra un nombre como x1, S2 o R3 con su subíndice. */
export function Variable({ name }: { name: string }) {
  const match = /^([A-Za-z]+)(\d+)$/.exec(name);
  if (!match) return <var>{name}</var>;
  return (
    <var>
      {match[1]}
      <sub>{match[2]}</sub>
    </var>
  );
}

export function VariableList({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 && (index === names.length - 1 ? " y " : ", ")}
          <Variable name={name} />
        </Fragment>
      ))}
    </>
  );
}

/** Convierte "x1=0" en la etiqueta del eje y "R2" en el número de restricción. */
export function LineName({ line }: { line: string }) {
  if (line === "x1=0") return <><Variable name="x1" /> = 0</>;
  if (line === "x2=0") return <><Variable name="x2" /> = 0</>;
  return <>({line.slice(1)})</>;
}

interface Term {
  name: string;
  /** Coeficiente ya formateado, con signo − si es negativo. */
  coefficient: string;
}

/** Escribe una combinación lineal: 3x₁ − x₂ + S₁. */
export function LinearExpression({ terms }: { terms: Term[] }) {
  if (terms.length === 0) return <>0</>;
  return (
    <>
      {terms.map((term, index) => {
        const composite = /\s/.test(term.coefficient);
        const negative = term.coefficient.startsWith("−") && !composite;
        const magnitude = negative ? term.coefficient.slice(1) : term.coefficient;
        const shown = magnitude === "1" ? "" : composite ? `(${magnitude})` : magnitude;
        const sign = negative ? "−" : "+";
        return (
          <Fragment key={term.name}>
            {index > 0 ? ` ${sign} ` : negative ? "−" : ""}
            {shown}
            <Variable name={term.name} />
          </Fragment>
        );
      })}
    </>
  );
}
