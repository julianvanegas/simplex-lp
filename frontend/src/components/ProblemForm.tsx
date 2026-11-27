"use client";

import { Fragment, useRef, type ChangeEvent } from "react";
import type { Relation, Sense } from "@/lib/contract";
import { examples } from "@/lib/solverClient";
import { MAX_DIMENSION, type ProblemDraft, type ValidationIssue } from "@/lib/validation";
import { RELATION_SYMBOL, Variable } from "./Math";
import type { SolveMode } from "./ResultsPanel";

interface ProblemFormProps {
  draft: ProblemDraft;
  exampleId: string;
  issues: ValidationIssue[];
  showIssues: boolean;
  loading: boolean;
  mode: SolveMode;
  onModeChange: (mode: SolveMode) => void;
  fileError: string | null;
  onSaveFile: () => void;
  onOpenFile: (text: string) => void;
  onDraftChange: (draft: ProblemDraft) => void;
  onExampleChange: (id: string) => void;
  onClear: () => void;
  onSolve: () => void;
}

const RELATIONS: Relation[] = ["<=", ">=", "="];

export function ProblemForm({
  draft,
  exampleId,
  issues,
  showIssues,
  loading,
  mode,
  onModeChange,
  fileError,
  onSaveFile,
  onOpenFile,
  onDraftChange,
  onExampleChange,
  onClear,
  onSolve,
}: ProblemFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se limpia para poder abrir de nuevo el mismo archivo después de editarlo.
    event.target.value = "";
    if (file) onOpenFile(await file.text());
  };
  const visibleIssues = showIssues ? issues : [];
  const invalid = new Set(visibleIssues.map((issue) => issue.field));
  const selectedExample = examples.find((example) => example.id === exampleId);
  const variableNames = draft.objective.map((_, j) => `x${j + 1}`);

  const cellProps = (field: string, label: string, value: string) => ({
    id: `field-${field}`,
    className: "cell",
    type: "text" as const,
    value,
    autoComplete: "off",
    spellCheck: false,
    "aria-label": label,
    "aria-invalid": invalid.has(field) || undefined,
    size: 5,
  });

  const setObjective = (j: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const objective = [...draft.objective];
    objective[j] = event.target.value;
    onDraftChange({ ...draft, objective });
  };

  const setConstraint = (
    i: number,
    change: (current: ProblemDraft["constraints"][number]) => ProblemDraft["constraints"][number],
  ) => {
    const constraints = draft.constraints.map((constraint, index) =>
      index === i ? change(constraint) : constraint,
    );
    onDraftChange({ ...draft, constraints });
  };

  return (
    <form
      className="sheet model"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSolve();
      }}
    >
      <div className="model-controls">
        <label className="field field-wide">
          <span>Ejemplo guardado</span>
          <select value={exampleId} onChange={(event) => onExampleChange(event.target.value)}>
            <option value="">Problema propio</option>
            {examples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Variables</span>
          <input
            id="field-n"
            className="cell"
            value={draft.nText}
            size={3}
            autoComplete="off"
            aria-invalid={invalid.has("n") || undefined}
            aria-describedby="dimension-help"
            onChange={(event) => onDraftChange({ ...draft, nText: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Restricciones</span>
          <input
            id="field-m"
            className="cell"
            value={draft.mText}
            size={3}
            autoComplete="off"
            aria-invalid={invalid.has("m") || undefined}
            aria-describedby="dimension-help"
            onChange={(event) => onDraftChange({ ...draft, mText: event.target.value })}
          />
        </label>
        <p id="dimension-help" className="hint">
          {selectedExample
            ? selectedExample.description
            : `Hasta ${MAX_DIMENSION} variables y ${MAX_DIMENSION} restricciones. Decimales con coma o punto.`}
        </p>
      </div>

      <div className="equation-scroll">
        <div
          className="equations"
          style={{ gridTemplateColumns: `max-content repeat(${draft.objective.length}, max-content) max-content max-content` }}
        >
          <div className="objective-label">
            <select
              aria-label="Tipo de optimización"
              value={draft.sense}
              onChange={(event) => onDraftChange({ ...draft, sense: event.target.value as Sense })}
            >
              <option value="max">Maximizar</option>
              <option value="min">Minimizar</option>
            </select>
            <span className="math"> <var>Z</var> =</span>
          </div>
          {draft.objective.map((value, j) => (
            <span className="term" key={variableNames[j]}>
              {j > 0 && <span className="plus">+</span>}
              <input
                {...cellProps(`c-${j}`, `Coeficiente de x${j + 1} en la función objetivo`, value)}
                onChange={setObjective(j)}
              />
              <Variable name={variableNames[j]} />
            </span>
          ))}
          <span />
          <span />

          {draft.constraints.map((constraint, i) => (
            <Fragment key={i}>
              <span className="row-label">{i === 0 ? "Sujeto a" : ""}<span className="row-number">({i + 1})</span></span>
              {constraint.coefficients.map((value, j) => (
                <span className="term" key={variableNames[j]}>
                  {j > 0 && <span className="plus">+</span>}
                  <input
                    {...cellProps(`a-${i}-${j}`, `Coeficiente de x${j + 1} en la restricción ${i + 1}`, value)}
                    onChange={(event) =>
                      setConstraint(i, (current) => {
                        const coefficients = [...current.coefficients];
                        coefficients[j] = event.target.value;
                        return { ...current, coefficients };
                      })
                    }
                  />
                  <Variable name={variableNames[j]} />
                </span>
              ))}
              <select
                className="relation"
                aria-label={`Relación de la restricción ${i + 1}`}
                value={constraint.relation}
                onChange={(event) =>
                  setConstraint(i, (current) => ({ ...current, relation: event.target.value as Relation }))
                }
              >
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {RELATION_SYMBOL[relation]}
                  </option>
                ))}
              </select>
              <input
                {...cellProps(`b-${i}`, `Lado derecho de la restricción ${i + 1}`, constraint.rhs)}
                onChange={(event) =>
                  setConstraint(i, (current) => ({ ...current, rhs: event.target.value }))
                }
              />
            </Fragment>
          ))}

          <span />
          {variableNames.map((name, j) => (
            <span className="term term-fixed" key={name}>
              {j > 0 && <span className="plus">,</span>}
              <span className="cell-blank" />
              <Variable name={name} />
            </span>
          ))}
          <span className="relation relation-fixed">≥</span>
          <span className="cell cell-fixed">0</span>
        </div>
      </div>

      {visibleIssues.length > 0 && (
        <div className="issue-list" role="alert">
          <h2>Corrige {visibleIssues.length === 1 ? "este dato" : `estos ${visibleIssues.length} datos`} para continuar</h2>
          <ul>
            {visibleIssues.slice(0, 8).map((issue, index) => (
              <li key={`${issue.field}-${index}`}>
                <a href={`#field-${issue.field}`}>{issue.message}</a>
              </li>
            ))}
          </ul>
          {visibleIssues.length > 8 && <p>Y {visibleIssues.length - 8} más, marcados en el formulario.</p>}
        </div>
      )}

      {fileError && (
        <div className="issue-list" role="alert">
          <h2>No se pudo abrir el archivo</h2>
          <p>{fileError}</p>
        </div>
      )}

      <div className="model-actions">
        <label className="mode-picker">
          Mostrar
          <select value={mode} onChange={(event) => onModeChange(event.target.value as SolveMode)}>
            <option value="direct">Solución directa</option>
            <option value="steps">Paso a paso</option>
          </select>
        </label>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={readFile}
        />
        <button type="button" className="button-quiet" onClick={() => fileInput.current?.click()}>
          Abrir archivo
        </button>
        <button type="button" className="button-quiet" onClick={onSaveFile}>
          Guardar archivo
        </button>
        <button type="button" className="button-quiet" onClick={onClear}>
          Vaciar coeficientes
        </button>
        <button type="submit" className="button-main" disabled={loading}>
          {loading ? "Resolviendo…" : "Resolver"}
        </button>
      </div>
    </form>
  );
}
