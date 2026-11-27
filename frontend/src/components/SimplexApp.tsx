"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Problem, SolveResponse } from "@/lib/contract";
import { downloadProblem, parseProblemFile } from "@/lib/fileIO";
import { BackendUnavailableError, examples, solveProblem } from "@/lib/solverClient";
import {
  draftToProblem,
  emptyDraft,
  parseDimension,
  problemToDraft,
  resizeDraft,
  validateDraft,
  type ProblemDraft,
} from "@/lib/validation";
import { ProblemForm } from "./ProblemForm";
import { ResultsPanel, type SolveMode } from "./ResultsPanel";

interface SolvedState {
  problem: Problem;
  response: SolveResponse;
}

export function SimplexApp() {
  const [draft, setDraft] = useState<ProblemDraft>(() => problemToDraft(examples[0].problem));
  const [exampleId, setExampleId] = useState(examples[0].id);
  const [showIssues, setShowIssues] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [solved, setSolved] = useState<SolvedState | null>(null);
  const [mode, setMode] = useState<SolveMode>("direct");
  const [fileError, setFileError] = useState<string | null>(null);
  const requestId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => validateDraft(draft), [draft]);

  useEffect(() => {
    if (solved || connectionError) resultsRef.current?.focus();
  }, [solved, connectionError]);

  const resetOutcome = () => {
    requestId.current += 1;
    setLoading(false);
    setSolved(null);
    setConnectionError(false);
  };

  const editDraft = (next: ProblemDraft) => {
    const n = parseDimension(next.nText);
    const m = parseDimension(next.mText);
    const sized = resizeDraft(
      next,
      n ?? next.objective.length,
      m ?? next.constraints.length,
    );
    setDraft(sized);
    setExampleId("");
    setFileError(null);
    resetOutcome();
  };

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    setExampleId(id);
    setShowIssues(false);
    setFileError(null);
    resetOutcome();
    if (example) setDraft(problemToDraft(example.problem));
  };

  const clear = () => {
    setDraft(emptyDraft(draft.objective.length, draft.constraints.length, draft.sense));
    setExampleId("");
    setShowIssues(false);
    setFileError(null);
    resetOutcome();
  };

  const saveFile = () => {
    setFileError(null);
    if (issues.length > 0) {
      // Solo se guardan problemas completos; se marcan los datos que faltan.
      setShowIssues(true);
      return;
    }
    downloadProblem(draftToProblem(draft), `${exampleId || "problema"}.json`);
  };

  const openFile = (text: string) => {
    const result = parseProblemFile(text);
    if (!result.ok) {
      setFileError(result.message);
      return;
    }
    setDraft(problemToDraft(result.problem));
    setExampleId("");
    setShowIssues(false);
    setFileError(null);
    resetOutcome();
  };

  const solve = async () => {
    setShowIssues(true);
    resetOutcome();
    if (issues.length > 0) return;
    const problem = draftToProblem(draft);
    const current = requestId.current;
    setLoading(true);
    try {
      const response = await solveProblem(problem);
      if (current === requestId.current) setSolved({ problem, response });
    } catch (error) {
      if (!(error instanceof BackendUnavailableError)) throw error;
      if (current === requestId.current) setConnectionError(true);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="logo" aria-label="SimpleX LP">
          <span aria-hidden="true">
            Simple<span className="logo-x">X</span>
            <span className="logo-box"><span>LP</span></span>
          </span>
        </h1>
      </header>

      <main>
        <ProblemForm
          draft={draft}
          exampleId={exampleId}
          issues={issues}
          showIssues={showIssues}
          loading={loading}
          mode={mode}
          onModeChange={setMode}
          fileError={fileError}
          onSaveFile={saveFile}
          onOpenFile={openFile}
          onDraftChange={editDraft}
          onExampleChange={loadExample}
          onClear={clear}
          onSolve={solve}
        />

        <div ref={resultsRef} tabIndex={-1} className="results-anchor" aria-live="polite">
          {connectionError && (
            <section className="notice notice-error">
              <h2>No se pudo conectar con el servidor de cálculo</h2>
              <p>
                El problema está bien escrito, pero no hubo respuesta del servidor. En esta
                demostración solo responden los problemas de la lista de ejemplos: carga uno
                para ver el resultado.
              </p>
            </section>
          )}
          {solved && (
            <ResultsPanel
              problem={solved.problem}
              response={solved.response}
              mode={mode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
