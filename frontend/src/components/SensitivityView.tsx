import type { SolveResponse } from "@/lib/contract";
import { formatSolver } from "@/lib/numbers";
import { Variable } from "./Math";

export function SensitivityView({ response }: { response: SolveResponse }) {
  const { sensitivity } = response;
  if (!sensitivity) {
    return (
      <p className="empty">
        El análisis de sensibilidad parte de una solución óptima, y este problema no tiene ninguna.
      </p>
    );
  }
  return (
    <div className="sensitivity">
      <h2>Informe de sensibilidad</h2>
      <p className="hint">
        Valores sobre la <var>Z</var> original, con el formato de Solver de Excel. 1E+30 significa sin límite.
      </p>
      <div className="table-scroll">
        <table className="data-table solver-table">
          <caption>Celdas de variables</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col" className="num">Valor final</th>
              <th scope="col" className="num">Costo reducido</th>
              <th scope="col" className="num">Coeficiente objetivo</th>
              <th scope="col" className="num">Aumento permisible</th>
              <th scope="col" className="num">Reducción permisible</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.variables.map((variable) => (
              <tr key={variable.name}>
                <th scope="row"><Variable name={variable.name} /></th>
                <td className="num">{formatSolver(variable.finalValue)}</td>
                <td className="num">{formatSolver(variable.reducedCost)}</td>
                <td className="num">{formatSolver(variable.objectiveCoefficient)}</td>
                <td className="num">{formatSolver(variable.allowableIncrease)}</td>
                <td className="num">{formatSolver(variable.allowableDecrease)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data-table solver-table">
          <caption>Restricciones</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col" className="num">Valor final</th>
              <th scope="col" className="num">Precio sombra</th>
              <th scope="col" className="num">Lado derecho</th>
              <th scope="col" className="num">Aumento permisible</th>
              <th scope="col" className="num">Reducción permisible</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.constraints.map((constraint, index) => (
              <tr key={constraint.name}>
                <th scope="row">Restricción {index + 1}</th>
                <td className="num">{formatSolver(constraint.finalValue)}</td>
                <td className="num">{formatSolver(constraint.shadowPrice)}</td>
                <td className="num">{formatSolver(constraint.rhs)}</td>
                <td className="num">{formatSolver(constraint.allowableIncrease)}</td>
                <td className="num">{formatSolver(constraint.allowableDecrease)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
