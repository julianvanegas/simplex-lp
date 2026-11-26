"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Constraint, Problem, SolveResponse } from "@/lib/contract";
import { buildPlaybackSteps, type PlaybackStep } from "@/lib/graphPlayback";
import { formatBigM, formatDecimal, formatRational, toNumber, type NumberFormat } from "@/lib/numbers";
import { LinearExpression, LineName, RELATION_SYMBOL, Variable, VariableList } from "./Math";

type Point = [number, number];

const WIDTH = 680;
const HEIGHT = 500;
const MARGIN = { left: 52, right: 28, top: 22, bottom: 46 };
const EPSILON = 1e-9;
const STEP_DURATION_MS = 1800;

/** Recorta un polígono al semiplano a·x + b·y ≤ r (Sutherland–Hodgman). */
function clipHalfPlane(polygon: Point[], a: number, b: number, r: number): Point[] {
  const output: Point[] = [];
  const excess = ([x, y]: Point) => a * x + b * y - r;
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const currentExcess = excess(current);
    const nextExcess = excess(next);
    if (currentExcess <= EPSILON) output.push(current);
    if ((currentExcess > EPSILON && nextExcess < -EPSILON) || (currentExcess < -EPSILON && nextExcess > EPSILON)) {
      const t = currentExcess / (currentExcess - nextExcess);
      output.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  });
  return output;
}

function feasiblePolygon(constraints: Constraint[], maxX: number, maxY: number): Point[] {
  let polygon: Point[] = [[0, 0], [maxX, 0], [maxX, maxY], [0, maxY]];
  for (const { coefficients: [a, b], relation, rhs } of constraints) {
    if (a === 0 && b === 0) continue;
    if (relation !== ">=") polygon = clipHalfPlane(polygon, a, b, rhs);
    if (relation !== "<=") polygon = clipHalfPlane(polygon, -a, -b, -rhs);
  }
  return polygon;
}

function lineInBox(a: number, b: number, r: number, maxX: number, maxY: number): [Point, Point] | null {
  const candidates: Point[] = [];
  if (b !== 0) {
    candidates.push([0, r / b], [maxX, (r - a * maxX) / b]);
  }
  if (a !== 0) {
    candidates.push([r / a, 0], [(r - b * maxY) / a, maxY]);
  }
  const inside = candidates.filter(
    ([x, y]) => x >= -EPSILON && x <= maxX + EPSILON && y >= -EPSILON && y <= maxY + EPSILON,
  );
  if (inside.length < 2) return null;
  let best: [Point, Point] | null = null;
  let bestLength = -1;
  inside.forEach((p, i) => {
    inside.slice(i + 1).forEach((q) => {
      const length = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (length > bestLength) {
        bestLength = length;
        best = [p, q];
      }
    });
  });
  return bestLength > EPSILON ? best : null;
}

function ticks(max: number): number[] {
  const rough = max / 6;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((k) => k * power).find((candidate) => candidate >= rough) ?? power;
  const count = Math.floor(max / step + EPSILON);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

function lineTerms(a: string, b: string) {
  return [
    { name: "x1", coefficient: a },
    { name: "x2", coefficient: b },
  ].filter((term) => term.coefficient !== "0");
}

function StepExplanation({ step }: { step: PlaybackStep }) {
  const { decision } = step.iteration;
  switch (decision.type) {
    case "pivot":
      return (
        <>
          Entra <Variable name={decision.entering} /> y sale <Variable name={decision.leaving} />
          {step.samePointAsNext ? ", pero el punto no cambia porque la razón mínima es 0." : ": se avanza al siguiente punto."}
        </>
      );
    case "alternate-pivot":
      return (
        <>
          {decision.firstOptimal && "Solución óptima. "}Entra <Variable name={decision.entering} /> con coeficiente 0 y
          sale <Variable name={decision.leaving} />: <var>Z</var> no cambia.
        </>
      );
    case "optimal":
      return <>Solución óptima: ninguna variable mejora <var>Z</var>.</>;
    case "alternate-optimal":
      return <>Otra solución óptima, con el mismo valor de <var>Z</var>.</>;
    case "infeasible":
      return <>No hay más mejoras y quedan artificiales positivas: el problema es infactible.</>;
    case "unbounded":
      return <><Variable name={decision.entering} /> puede aumentar sin límite: el problema no está acotado.</>;
  }
}

interface GraphViewProps {
  problem: Problem;
  response: SolveResponse;
  format: NumberFormat;
}

export function GraphView({ problem, response, format }: GraphViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const steps = useMemo(() => buildPlaybackSteps(problem, response), [problem, response]);
  const lastStep = steps.length - 1;
  const graph = response.graphical;

  useEffect(() => {
    if (!playing || stepIndex === null) return;
    const timer = setTimeout(() => {
      const next = Math.min(stepIndex + 1, lastStep);
      setStepIndex(next);
      if (next === lastStep) setPlaying(false);
    }, STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [playing, stepIndex, lastStep]);

  if (!graph.applicable) {
    return (
      <p className="empty">
        El método gráfico no aplica: este problema tiene {problem.objective.length} variables y solo se puede dibujar
        con 2.
      </p>
    );
  }

  const coords = [...graph.vertices, ...graph.infeasibleCorners, ...steps].map(
    (point): Point => [toNumber(point.x1), toNumber(point.x2)],
  );
  let maxX = Math.max(1, ...coords.map(([x]) => x)) * 1.15;
  let maxY = Math.max(1, ...coords.map(([, y]) => y)) * 1.15;
  maxX = Math.max(maxX, maxY * 0.6);
  maxY = Math.max(maxY, maxX * 0.6);

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const px = (x: number) => MARGIN.left + (x / maxX) * plotWidth;
  const py = (y: number) => MARGIN.top + plotHeight - (y / maxY) * plotHeight;
  const path = (points: Point[]) => points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");

  const region = graph.regionEmpty ? [] : feasiblePolygon(problem.constraints, maxX, maxY);
  const optimalVertices = graph.vertices.filter((vertex) => vertex.optimal);
  const objective = graph.objectiveLine;
  const objectiveSegment = objective
    ? lineInBox(toNumber(objective.a), toNumber(objective.b), toNumber(objective.z), maxX, maxY)
    : null;

  const sign = problem.sense === "max" ? 1 : -1;
  const [c1, c2] = problem.objective;
  const norm = Math.hypot(c1 / maxX * plotWidth, c2 / maxY * plotHeight);
  const currentStep = stepIndex === null ? null : steps[stepIndex];
  const currentPoint: Point | null = currentStep && [toNumber(currentStep.x1), toNumber(currentStep.x2)];
  const showOptimum = stepIndex === null || stepIndex === lastStep;
  const shownLine = currentPoint
    ? lineInBox(c1, c2, c1 * currentPoint[0] + c2 * currentPoint[1], maxX, maxY)
    : objectiveSegment;
  const currentVertex = currentStep
    ? graph.vertices.find((vertex) => vertex.x1 === currentStep.x1 && vertex.x2 === currentStep.x2)?.label
    : undefined;
  const highlighted = hovered ?? currentVertex;
  const anchor = currentStep ?? optimalVertices[0];
  const arrow =
    anchor && norm > 0
      ? {
          x: px(toNumber(anchor.x1)),
          y: py(toNumber(anchor.x2)),
          dx: (sign * (c1 / maxX) * plotWidth * 46) / norm,
          dy: (-sign * (c2 / maxY) * plotHeight * 46) / norm,
        }
      : null;

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setStepIndex(stepIndex === null || stepIndex >= lastStep ? 0 : stepIndex);
    setPlaying(lastStep > 0);
  };

  /** Un índice negativo vuelve al gráfico sin recorrido. */
  const goToStep = (index: number) => {
    setPlaying(false);
    setStepIndex(index < 0 ? null : Math.min(index, lastStep));
  };

  const playLabel = playing
    ? "Pausar"
    : stepIndex === null
      ? "Reproducir paso a paso"
      : stepIndex >= lastStep
        ? "Reproducir de nuevo"
        : "Continuar";

  const summary = graph.regionEmpty
    ? "No hay región factible: las restricciones no tienen puntos en común con x₁, x₂ ≥ 0."
    : graph.regionBounded
      ? null
      : "La región factible no está acotada: continúa más allá del área dibujada.";

  return (
    <div className="graph">
      <figure>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Región factible, restricciones, vértices y recta objetivo">
          <defs>
            <pattern id="region-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" className="hatch-bg" />
              <line x1="0" y1="0" x2="0" y2="9" className="hatch-line" />
            </pattern>
            <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="arrow-head" />
            </marker>
            <clipPath id="plot-area">
              <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          {ticks(maxX).map((tick) => (
            <g key={`x${tick}`}>
              <line className="grid-line" x1={px(tick)} x2={px(tick)} y1={py(0)} y2={py(maxY)} />
              <text className="tick" x={px(tick)} y={py(0) + 18} textAnchor="middle">{formatDecimal(tick, 2)}</text>
            </g>
          ))}
          {ticks(maxY).map((tick) => (
            <g key={`y${tick}`}>
              <line className="grid-line" x1={px(0)} x2={px(maxX)} y1={py(tick)} y2={py(tick)} />
              <text className="tick" x={px(0) - 9} y={py(tick) + 4} textAnchor="end">{formatDecimal(tick, 2)}</text>
            </g>
          ))}

          {region.length > 0 && <polygon className="region" points={path(region)} />}

          <g clipPath="url(#plot-area)">
            {problem.constraints.map(({ coefficients: [a, b], rhs }, index) => {
              const segment = lineInBox(a, b, rhs, maxX, maxY);
              if (!segment) return null;
              const [from, to] = segment[0][0] < segment[1][0] || (segment[0][0] === segment[1][0] && segment[0][1] < segment[1][1]) ? segment : [segment[1], segment[0]];
              const labelX = px(from[0] + 0.9 * (to[0] - from[0]));
              const labelY = py(from[1] + 0.9 * (to[1] - from[1]));
              return (
                <g key={index}>
                  <line className="constraint-line" x1={px(segment[0][0])} y1={py(segment[0][1])} x2={px(segment[1][0])} y2={py(segment[1][1])} />
                  <text className="line-label" x={Math.min(labelX + 6, WIDTH - MARGIN.right - 28)} y={Math.max(labelY - 6, MARGIN.top + 16)}>
                    ({index + 1})
                  </text>
                </g>
              );
            })}
            {showOptimum && response.multipleOptima && optimalVertices.length >= 2 && (
              <line
                className="optimal-edge"
                x1={px(toNumber(optimalVertices[0].x1))}
                y1={py(toNumber(optimalVertices[0].x2))}
                x2={px(toNumber(optimalVertices[optimalVertices.length - 1].x1))}
                y2={py(toNumber(optimalVertices[optimalVertices.length - 1].x2))}
              />
            )}
            {shownLine && (
              <line className="objective-line" x1={px(shownLine[0][0])} y1={py(shownLine[0][1])} x2={px(shownLine[1][0])} y2={py(shownLine[1][1])} />
            )}
          </g>

          <line className="axis" x1={px(0)} x2={px(maxX)} y1={py(0)} y2={py(0)} />
          <line className="axis" x1={px(0)} x2={px(0)} y1={py(0)} y2={py(maxY)} />
          <text className="axis-name" x={px(maxX)} y={py(0) + 36} textAnchor="end">x₁</text>
          <text className="axis-name" x={px(0) + 8} y={py(maxY) + 4}>x₂</text>

          {arrow && (
            <line className="objective-arrow" x1={arrow.x} y1={arrow.y} x2={arrow.x + arrow.dx} y2={arrow.y + arrow.dy} markerEnd="url(#arrow-head)" />
          )}

          {graph.infeasibleCorners.map((corner) => {
            const x = toNumber(corner.x1);
            const y = toNumber(corner.x2);
            return x <= maxX && y <= maxY ? (
              <circle key={`${corner.x1}-${corner.x2}`} className="corner-out" cx={px(x)} cy={py(y)} r="3.5" />
            ) : null;
          })}
          {graph.vertices.map((vertex) => {
            const x = px(toNumber(vertex.x1));
            const y = py(toNumber(vertex.x2));
            const active = highlighted === vertex.label;
            return (
              <g key={vertex.label} onMouseEnter={() => setHovered(vertex.label)} onMouseLeave={() => setHovered(null)}>
                {vertex.optimal && showOptimum && <circle className="vertex-halo" cx={x} cy={y} r="13" />}
                <circle className={active ? "vertex vertex-active" : "vertex"} cx={x} cy={y} r={active ? 6.5 : 5} />
                <text className="vertex-label" x={x + 9} y={y - 9}>{vertex.label}</text>
              </g>
            );
          })}

          {stepIndex !== null &&
            steps.slice(1, stepIndex + 1).map((step, index) => {
              const previous = steps[index];
              return (
                <line
                  key={step.iteration.index}
                  className="trace-line"
                  pathLength={1}
                  x1={px(toNumber(previous.x1))}
                  y1={py(toNumber(previous.x2))}
                  x2={px(toNumber(step.x1))}
                  y2={py(toNumber(step.x2))}
                />
              );
            })}
          {currentPoint && currentStep && (
            <g
              className="trace-marker"
              style={{ transform: `translate(${px(currentPoint[0])}px, ${py(currentPoint[1])}px)` }}
            >
              <circle r="12" />
              <text textAnchor="middle" y="5">{currentStep.iteration.index}</text>
            </g>
          )}
        </svg>

        <div className="player">
          <div className="player-controls">
            <button
              type="button"
              className="button-step"
              aria-label="Anterior"
              title="Anterior"
              disabled={stepIndex === null}
              onClick={() => goToStep((stepIndex ?? 0) - 1)}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 2h2v10H2zM12 2v10L5 7z" /></svg>
            </button>
            <button type="button" className="button-play" aria-label={playLabel} title={playLabel} onClick={togglePlayback}>
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" /> : <path d="M3 1.5v11L12 7z" />}
              </svg>
            </button>
            <button
              type="button"
              className="button-step"
              aria-label="Siguiente"
              title="Siguiente"
              disabled={stepIndex !== null && stepIndex >= lastStep}
              onClick={() => goToStep(stepIndex === null ? 0 : stepIndex + 1)}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M10 2h2v10h-2zM2 2v10l7-5z" /></svg>
            </button>
          </div>
          {currentStep && (
            <div className="player-status" role="status">
              <p className="math player-z"><var>Z</var> = {formatBigM(currentStep.z, format)}</p>
              <p>
                {currentStep.artificials.length > 0 && (
                  <>
                    Este punto aún no es factible: <VariableList names={currentStep.artificials} />{" "}
                    {currentStep.artificials.length === 1 ? "sigue" : "siguen"} en la base.{" "}
                  </>
                )}
                <StepExplanation step={currentStep} />
              </p>
            </div>
          )}
        </div>

        <figcaption>
          {!graph.regionEmpty && <span className="legend legend-region">Región factible</span>}
          {!graph.regionEmpty && <span className="legend legend-vertex">Vértice factible</span>}
          <span className="legend legend-out">Vértice no factible</span>
          {stepIndex !== null && <span className="legend legend-trace">Recorrido del Simplex</span>}
          {stepIndex !== null && <span className="legend legend-objective">Recta de Z por el punto actual</span>}
          {stepIndex === null && objective && (
            <span className="legend legend-objective math">
              <LinearExpression terms={lineTerms(formatRational(objective.a, format), formatRational(objective.b, format))} />{" "}
              = {formatRational(objective.z, format)}
            </span>
          )}
        </figcaption>
      </figure>

      <div className="graph-side">
        {summary && <p className="graph-note">{summary}</p>}
        <ol className="constraint-key math">
          {problem.constraints.map(({ coefficients: [a, b], relation, rhs }, index) => (
            <li key={index} value={index + 1}>
              <LinearExpression terms={lineTerms(formatDecimal(a), formatDecimal(b))} /> {RELATION_SYMBOL[relation]} {formatDecimal(rhs)}
            </li>
          ))}
        </ol>
        {graph.vertices.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <caption>Vértices de la región factible</caption>
              <thead>
                <tr>
                  <th scope="col">Vértice</th>
                  <th scope="col" className="num"><Variable name="x1" /></th>
                  <th scope="col" className="num"><Variable name="x2" /></th>
                  <th scope="col" className="num"><var>Z</var></th>
                  <th scope="col">Rectas</th>
                </tr>
              </thead>
              <tbody>
                {graph.vertices.map((vertex) => (
                  <tr
                    key={vertex.label}
                    className={[vertex.optimal && showOptimum ? "row-optimal" : "", highlighted === vertex.label ? "row-hover" : ""].join(" ").trim() || undefined}
                    onMouseEnter={() => setHovered(vertex.label)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <th scope="row">{vertex.label}{vertex.optimal && showOptimum && <span className="optimal-tag"> óptimo</span>}</th>
                    <td className="num">{formatRational(vertex.x1, format)}</td>
                    <td className="num">{formatRational(vertex.x2, format)}</td>
                    <td className="num">{formatRational(vertex.z, format)}</td>
                    <td>
                      {vertex.lines.map((line, index) => (
                        <Fragment key={line}>{index > 0 && ", "}<LineName line={line} /></Fragment>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
