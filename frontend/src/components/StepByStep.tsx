import { Fragment } from "react";
import type {
  BigMValue,
  Iteration,
  PivotDecision,
  Problem,
  RowOperation,
  SolveResponse,
  StandardForm,
} from "@/lib/contract";
import {
  formatBigM,
  formatRational,
  isZero,
  negateBigM,
  type NumberFormat,
} from "@/lib/numbers";
import { LinearExpression, RELATION_SYMBOL, Variable, VariableList } from "./Math";

interface StepProps {
  format: NumberFormat;
}

const KIND_LABEL = { slack: "holgura", excess: "exceso", artificial: "artificial" } as const;

function StandardFormView({ form, problem, format }: StepProps & { form: StandardForm; problem: Problem }) {
  const added = form.variables.filter((variable) => variable.kind !== "decision");
  const targetLabel = form.objectiveTarget === "-Z" ? "−Z" : "Z";
  const flipped = form.constraints.filter((constraint) => constraint.flipped);
  const objectiveTerms = form.objective
    .filter((term) => !isZero(term.coef.c) || !isZero(term.coef.m))
    .map((term) => ({ name: term.var, coefficient: formatBigM(term.coef, format) }));

  return (
    <section className="standard-form">
      <h2>Forma estándar</h2>
      <ul className="prep-notes">
        {form.minToMax && (
          <li>
            Minimizar <var>Z</var> equivale a maximizar −<var>Z</var>, así que se cambian los signos de los costos.
          </li>
        )}
        {flipped.map((constraint) => (
          <li key={constraint.index}>
            La restricción ({constraint.index}) tiene lado derecho negativo: se multiplica por −1 y{" "}
            {RELATION_SYMBOL[constraint.originalRelation]} pasa a {RELATION_SYMBOL[constraint.normalizedRelation]}.
          </li>
        ))}
        {added.map((variable) => (
          <li key={variable.name}>
            <Variable name={variable.name} /> es la variable de {KIND_LABEL[variable.kind as keyof typeof KIND_LABEL]} de
            la restricción ({variable.constraint}).
          </li>
        ))}
      </ul>
      <div className="math model-display">
        <p>
          Maximizar <var>{targetLabel}</var> = <LinearExpression terms={objectiveTerms} />
        </p>
        {form.constraints.map((constraint) => (
          <p key={constraint.index}>
            <span className="equation-number">({constraint.index})</span>
            <LinearExpression
              terms={constraint.terms.map((term) => ({
                name: term.var,
                coefficient: formatRational(term.coef, format),
              }))}
            />{" "}
            = {formatRational(constraint.rhs, format)}
          </p>
        ))}
        <p>
          <VariableList names={form.variables.map((variable) => variable.name).slice(0, problem.objective.length)} />
          {added.length > 0 && <>, <VariableList names={added.map((variable) => variable.name)} /></>} ≥ 0
        </p>
      </div>
      <p>
        Base inicial: <VariableList names={form.initialBasis} />.
        {form.pricedOutRows.length > 0 &&
          ` Para que las artificiales básicas queden con coeficiente 0 en el renglón (0), se le resta M por ${
            form.pricedOutRows.length === 1 ? "la ecuación" : "las ecuaciones"
          } ${form.pricedOutRows.map((row) => `(${row})`).join(", ")}.`}
      </p>
    </section>
  );
}

function Operation({ operation, format }: StepProps & { operation: RowOperation }) {
  const name = (row: number) => `(${row})`;
  if (operation.kind === "scale") {
    return (
      <li>
        {name(operation.target)} ← {formatRational(operation.factor, format)} × {name(operation.source)}
      </li>
    );
  }
  const factor = formatBigM(operation.factor, format);
  const needsParens = /\s/.test(factor) || factor.startsWith("−");
  return (
    <li>
      {name(operation.target)} ← {name(operation.target)} + {needsParens ? `(${factor})` : factor} × {name(operation.source)}
    </li>
  );
}

function pivotOf(iteration: Iteration): PivotDecision | null {
  const decision = iteration.decision;
  return decision.type === "pivot" || decision.type === "alternate-pivot" ? decision : null;
}

function TableauTable({
  iteration,
  columns,
  sense,
  format,
}: StepProps & { iteration: Iteration; columns: string[]; sense: Problem["sense"] }) {
  const { tableau, decision } = iteration;
  const pivot = pivotOf(iteration);
  const enteringColumn = pivot?.enteringColumn ?? (decision.type === "unbounded" ? decision.enteringColumn : -1);
  const value = (v: BigMValue) => formatBigM(v, format);
  const columnClass = (j: number) => (j === enteringColumn ? "col-in" : undefined);

  return (
    <div className="table-scroll" tabIndex={0} role="group" aria-label={`Tabla de la iteración ${iteration.index}`}>
      <table className="tableau">
        <thead>
          <tr>
            <th scope="col" className="sticky-a">Ec.</th>
            <th scope="col" className="sticky-b">VB</th>
            <th scope="col"><var>Z</var></th>
            {columns.map((name, j) => (
              <th scope="col" key={name} className={columnClass(j)}><Variable name={name} /></th>
            ))}
            <th scope="col" className="rhs">Lado der.</th>
            <th scope="col">Razón</th>
          </tr>
        </thead>
        <tbody>
          <tr className="row-zero">
            <th scope="row" className="sticky-a">(0)</th>
            <th scope="row" className="sticky-b">{sense === "min" ? "−Z" : <var>Z</var>}</th>
            <td>{tableau.objectiveRow.zCoefficient === 1 ? "1" : "−1"}</td>
            {tableau.objectiveRow.coefficients.map((coefficient, j) => (
              <td key={columns[j]} className={columnClass(j)}>{value(coefficient)}</td>
            ))}
            <td className="rhs">{value(tableau.objectiveRow.rhs)}</td>
            <td />
          </tr>
          {tableau.rows.map((row) => {
            const isPivotRow = pivot?.pivotRow === row.equation;
            return (
              <tr key={row.equation} className={isPivotRow ? "row-out" : undefined}>
                <th scope="row" className="sticky-a">({row.equation})</th>
                <th scope="row" className="sticky-b"><Variable name={row.basic} /></th>
                <td>0</td>
                {row.coefficients.map((coefficient, j) => {
                  const isPivot = isPivotRow && j === enteringColumn;
                  return (
                    <td key={columns[j]} className={isPivot ? "pivot-cell" : columnClass(j)}>
                      {formatRational(coefficient, format)}
                    </td>
                  );
                })}
                <td className="rhs">{formatRational(row.rhs, format)}</td>
                <td className={isPivotRow ? "ratio-min" : undefined}>
                  {row.ratio === null ? (pivot ? "—" : "") : formatRational(row.ratio, format)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DecisionSummary({ iteration, format }: StepProps & { iteration: Iteration }) {
  const { decision } = iteration;
  if (decision.type === "pivot" || decision.type === "alternate-pivot") {
    return (
      <>
        {decision.type === "alternate-pivot" && decision.firstOptimal && (
          <p className="verdict">
            Esta tabla ya es óptima. <Variable name={decision.entering} /> no es básica y tiene coeficiente 0 en el renglón (0):
            al entrar, <var>Z</var> no cambia y se llega a otra solución óptima.
          </p>
        )}
        <dl className="pivot-facts">
          <div className="fact-in">
            <dt>Entra</dt>
            <dd><Variable name={decision.entering} /> <small>coeficiente {formatBigM(decision.enteringCost, format)}</small></dd>
          </div>
          <div className="fact-out">
            <dt>Sale</dt>
            <dd><Variable name={decision.leaving} /> <small>razón mínima {formatRational(decision.minRatio, format)}</small></dd>
          </div>
          <div className="fact-pivot">
            <dt>Pivote</dt>
            <dd>{formatRational(decision.pivotValue, format)} <small>ecuación ({decision.pivotRow})</small></dd>
          </div>
        </dl>
        {decision.rule === "bland" && <p className="tie-note">Regla de Bland activa: entra la variable elegible de menor subíndice.</p>}
        {decision.enteringTie.length > 0 && (
          <p className="tie-note">
            Empate para entrar entre <VariableList names={decision.enteringTie} />: se elige la de menor subíndice.
          </p>
        )}
        {decision.leavingTie.length > 0 && (
          <p className="tie-note">
            Empate en la razón mínima entre <VariableList names={decision.leavingTie} />: sale la de menor subíndice y la otra
            queda básica con valor 0.
          </p>
        )}
      </>
    );
  }
  if (decision.type === "optimal" || decision.type === "alternate-optimal") {
    return (
      <p className="verdict">
        {decision.type === "alternate-optimal" ? "Otra solución óptima: " : "Solución óptima: "}
        ningún coeficiente del renglón (0) es negativo.
      </p>
    );
  }
  if (decision.type === "infeasible") {
    return (
      <p className="verdict verdict-stop">
        No hay más mejoras y <VariableList names={decision.artificials} /> sigue con valor positivo: el problema es infactible.
      </p>
    );
  }
  return (
    <p className="verdict verdict-stop">
      Debería entrar <Variable name={decision.entering} />, pero ningún coeficiente de su columna es positivo: no hay razón
      mínima y el problema no está acotado.
    </p>
  );
}

export function StepByStep({ problem, response, format }: StepProps & { problem: Problem; response: SolveResponse }) {
  const columns = response.standardForm.variables.map((variable) => variable.name);
  return (
    <div className="steps">
      <StandardFormView form={response.standardForm} problem={problem} format={format} />
      <nav className="iteration-nav" aria-label="Ir a una iteración">
        {response.iterations.map((iteration) => (
          <a key={iteration.index} href={`#iteracion-${iteration.index}`}>{iteration.index}</a>
        ))}
      </nav>
      <ul className="color-key" aria-label="Convención de colores">
        <li className="key-in">Columna que entra</li>
        <li className="key-out">Fila que sale</li>
        <li className="key-pivot">Pivote</li>
      </ul>
      {response.iterations.map((iteration) => {
        const objective = iteration.tableau.objectiveRow.rhs;
        const z = problem.sense === "min" ? negateBigM(objective) : objective;
        return (
          <article key={iteration.index} id={`iteracion-${iteration.index}`} className="iteration">
            <h2>
              Iteración {iteration.index}
              {iteration.index === 0 && <span> Tabla inicial</span>}
              {iteration.phase === "alternate" && <span> Solución alternativa</span>}
            </h2>
            {response.cycleDetectedAt === iteration.index && (
              <p className="tie-note">Esta base ya había aparecido: hay un ciclo. Desde aquí se aplica la regla de Bland.</p>
            )}
            {iteration.operations && (
              <details className="operations">
                <summary>Operaciones de fila aplicadas</summary>
                <ul className="math">
                  {iteration.operations.map((operation, index) => (
                    <Operation key={index} operation={operation} format={format} />
                  ))}
                </ul>
              </details>
            )}
            <TableauTable iteration={iteration} columns={columns} sense={problem.sense} format={format} />
            <p className="basic-solution math">
              <span>
                {iteration.tableau.rows.map((row, index) => (
                  <Fragment key={row.equation}>
                    {index > 0 && ", "}
                    <Variable name={row.basic} /> = {formatRational(row.rhs, format)}
                  </Fragment>
                ))}
              </span>
              <span className="current-z"><var>Z</var> = {formatBigM(z, format)}</span>
            </p>
            <DecisionSummary iteration={iteration} format={format} />
          </article>
        );
      })}
    </div>
  );
}
