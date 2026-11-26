"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Problem, SolveResponse, Solution } from "@/lib/contract";
import { formatRational, type NumberFormat } from "@/lib/numbers";
import { GraphView } from "./GraphView";
import { RELATION_SYMBOL, Variable, VariableList } from "./Math";
import { SensitivityView } from "./SensitivityView";
import { StepByStep } from "./StepByStep";

type TabId = "solution" | "steps" | "graph" | "sensitivity";

interface ResultsPanelProps {
  problem: Problem;
  response: SolveResponse;
}

function pointText(solution: Solution, format: NumberFormat) {
  return `(${solution.variables.map((v) => formatRational(v.value, format)).join("; ")})`;
}

function StatusNotices({ problem, response, format }: ResultsPanelProps & { format: NumberFormat }) {
  const notices: { tone: "error" | "info"; title: string; body: ReactNode }[] = [];
  const last = response.iterations[response.iterations.length - 1].decision;
  const direction = problem.sense === "max" ? "crecer" : "disminuir";

  if (last.type === "infeasible") {
    notices.push({
      tone: "error",
      title: "El problema no tiene solución factible",
      body: (
        <>
          Ningún punto cumple todas las restricciones a la vez. Al terminar, <VariableList names={last.artificials} />{" "}
          sigue en la base con valor positivo. Revisa si alguna restricción contradice a otra.
        </>
      ),
    });
  }
  if (last.type === "unbounded") {
    notices.push({
      tone: "error",
      title: "El problema no está acotado",
      body: (
        <>
          <var>Z</var> puede {direction} sin límite al aumentar <Variable name={last.entering} />, porque ninguna
          restricción la detiene. Probablemente falta una restricción en la formulación.
        </>
      ),
    });
  }
  if (response.multipleOptima && response.solution) {
    notices.push({
      tone: "info",
      title: "Hay infinitas soluciones óptimas",
      body: response.alternateSolution ? (
        <>
          {pointText(response.solution, format)} y {pointText(response.alternateSolution, format)} dan el mismo valor
          de <var>Z</var>, y también cualquier punto del segmento entre ellas.
        </>
      ) : (
        <>
          Desde {pointText(response.solution, format)} se puede avanzar sin límite en la dirección (
          {response.optimalRay?.map((value) => formatRational(value, format)).join("; ")}) sin cambiar <var>Z</var>.
        </>
      ),
    });
  }
  if (response.degenerate) {
    notices.push({
      tone: "info",
      title: "La solución óptima es degenerada",
      body: "Al menos una variable básica vale 0. Los precios sombra y los rangos pueden no ser únicos.",
    });
  } else if (response.degenerateIterations.length > 0) {
    notices.push({
      tone: "info",
      title: "Hubo degeneración durante el proceso",
      body: `Alguna variable básica valió 0 en ${
        response.degenerateIterations.length === 1 ? "la iteración" : "las iteraciones"
      } ${response.degenerateIterations.join(", ")}. La solución final no es degenerada.`,
    });
  }
  return (
    <>
      {notices.map((notice) => (
        <section key={notice.title} className={`notice notice-${notice.tone}`}>
          <h2>{notice.title}</h2>
          <p>{notice.body}</p>
        </section>
      ))}
    </>
  );
}

function SolutionBlock({ title, solution, format }: { title?: string; solution: Solution; format: NumberFormat }) {
  return (
    <div className="solution-block">
      {title && <h3>{title}</h3>}
      <p className="z-value math">
        <var>Z</var> = {formatRational(solution.z, format)}
      </p>
      <div className="solution-tables">
        <div className="table-scroll">
          <table className="data-table">
            <caption>Variables de decisión</caption>
            <thead>
              <tr><th scope="col">Variable</th><th scope="col" className="num">Valor</th></tr>
            </thead>
            <tbody>
              {solution.variables.map((variable) => (
                <tr key={variable.name}>
                  <th scope="row"><Variable name={variable.name} /></th>
                  <td className="num">{formatRational(variable.value, format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption>Restricciones</caption>
            <thead>
              <tr>
                <th scope="col">Restricción</th>
                <th scope="col" className="num">Lado izquierdo</th>
                <th scope="col" className="num">Lado derecho</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">Holgura o exceso</th>
              </tr>
            </thead>
            <tbody>
              {solution.constraints.map((constraint) => (
                <tr key={constraint.index}>
                  <th scope="row">({constraint.index})</th>
                  <td className="num">{formatRational(constraint.lhs, format)}</td>
                  <td className="num">
                    {RELATION_SYMBOL[constraint.relation]} {formatRational(constraint.rhs, format)}
                  </td>
                  <td>{constraint.kind === "igualdad" ? "Igualdad" : constraint.kind === "holgura" ? "Holgura" : "Exceso"}</td>
                  <td className="num">{formatRational(constraint.amount, format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ResultsPanel({ problem, response }: ResultsPanelProps) {
  const [format, setFormat] = useState<NumberFormat>("fraction");
  const tabs: { id: TabId; label: string }[] = [
    { id: "solution", label: "Solución" },
    { id: "steps", label: "Paso a paso" },
    { id: "graph", label: "Método gráfico" },
    { id: "sensitivity", label: "Sensibilidad" },
  ];
  const [active, setActive] = useState<TabId>("solution");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length].id;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="results" aria-label="Resultados">
      <StatusNotices problem={problem} response={response} format={format} />

      <div className="results-bar">
        <div role="tablist" aria-label="Secciones del resultado" className="tabs">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => { tabRefs.current[tab.id] = element; }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              aria-controls="result-panel"
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="format-picker">
          Números
          <select value={format} onChange={(event) => setFormat(event.target.value as NumberFormat)}>
            <option value="fraction">Fracciones</option>
            <option value="decimal">Decimales</option>
          </select>
        </label>
      </div>

      <div id="result-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="sheet result-sheet">
        {active === "solution" &&
          (response.solution ? (
            <>
              <SolutionBlock
                title={response.alternateSolution ? "Primera solución óptima" : undefined}
                solution={response.solution}
                format={format}
              />
              {response.alternateSolution && (
                <SolutionBlock title="Otra solución óptima" solution={response.alternateSolution} format={format} />
              )}
            </>
          ) : (
            <p className="empty">
              {response.status === "infeasible"
                ? "No hay valores que reportar porque el problema no tiene puntos factibles."
                : "No hay valores que reportar porque Z no alcanza un valor óptimo."}
            </p>
          ))}
        {active === "steps" && <StepByStep problem={problem} response={response} format={format} />}
        {active === "graph" && <GraphView problem={problem} response={response} format={format} />}
        {active === "sensitivity" && <SensitivityView response={response} />}
      </div>
    </section>
  );
}
