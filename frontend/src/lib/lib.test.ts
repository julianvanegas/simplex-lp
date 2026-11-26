import { describe, expect, it } from "vitest";
import { buildPlaybackSteps } from "./graphPlayback";
import { formatBigM, formatRational, formatSolver } from "./numbers";
import { BackendUnavailableError, examples, solveProblem } from "./solverClient";
import {
  draftToProblem,
  emptyDraft,
  parseNumber,
  problemToDraft,
  resizeDraft,
  validateDraft,
} from "./validation";

describe("validación", () => {
  it("acepta coma, punto y signo", () => {
    expect(parseNumber("0,3")).toBe(0.3);
    expect(parseNumber("-2.5")).toBe(-2.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1e5")).toBeNull();
  });

  it("reporta campos vacíos y valores no numéricos", () => {
    const draft = emptyDraft(1, 1);
    draft.objective[0] = "x";
    const fields = validateDraft(draft).map((issue) => issue.field);
    expect(fields).toEqual(["c-0", "a-0-0", "b-0"]);
  });

  it("reporta dimensiones fuera de rango e inconsistentes", () => {
    const draft = emptyDraft(2, 1);
    expect(validateDraft({ ...draft, nText: "21" })[0].field).toBe("n");
    expect(validateDraft({ ...draft, mText: "1,5" })[0].field).toBe("m");
    const messages = validateDraft({ ...draft, nText: "3" }).map((issue) => issue.message);
    expect(messages.some((message) => message.includes("se indicaron 3 variables"))).toBe(true);
  });

  it("conserva los valores al cambiar dimensiones", () => {
    const draft = problemToDraft(examples[0].problem);
    const resized = resizeDraft(draft, 3, 4);
    expect(resized.objective).toEqual(["3", "5", ""]);
    expect(resized.constraints).toHaveLength(4);
  });
});

describe("formato", () => {
  it("muestra M simbólica como en clase", () => {
    expect(formatBigM({ c: "2/5", m: "-11/10" }, "decimal")).toBe("−1,1M + 0,4");
    expect(formatBigM({ c: "0", m: "1" }, "fraction")).toBe("M");
    expect(formatRational("-1/3", "fraction")).toBe("−1/3");
  });

  it("usa la notación de Solver", () => {
    expect(formatSolver(null)).toBe("1E+30");
    expect(formatSolver("9/2")).toBe("4,5");
  });
});

describe("datos de demostración", () => {
  it("cada ejemplo pasa la validación y se recupera por su contenido", async () => {
    for (const example of examples) {
      const draft = problemToDraft(example.problem);
      expect(validateDraft(draft)).toEqual([]);
      await expect(solveProblem(draftToProblem(draft))).resolves.toBe(example.response);
    }
  });

  it("un problema no guardado se comporta como servidor desconectado", async () => {
    const problem = structuredClone(examples[0].problem);
    problem.objective[0] = 99;
    await expect(solveProblem(problem)).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("reproduce los resultados de los PDF", () => {
    const byId = Object.fromEntries(examples.map((example) => [example.id, example.response]));
    expect(byId.wyndor.solution?.z).toBe("36");
    expect(byId.radioterapia.solution?.z).toBe("21/4");
    expect(byId.multiples.multipleOptima).toBe(true);
    expect(byId.infactible.status).toBe("infeasible");
    expect(byId["no-acotado"].status).toBe("unbounded");
    expect(byId.degenerado.degenerate).toBe(true);
    expect(byId["tres-variables"].graphical.applicable).toBe(false);
  });
});

describe("reproducción del gráfico", () => {
  const stepsOf = (id: string) => {
    const example = examples.find((item) => item.id === id)!;
    return buildPlaybackSteps(example.problem, example.response);
  };
  const points = (id: string) => stepsOf(id).map((step) => [step.x1, step.x2]);

  it("recorre los vértices de cada iteración", () => {
    expect(points("wyndor")).toEqual([["0", "0"], ["0", "6"], ["2", "6"]]);
    expect(points("multiples").at(-1)).toEqual(["2", "6"]);
  });

  it("señala los puntos no factibles y Z con M", () => {
    const [first] = stepsOf("radioterapia");
    expect(first.artificials).toEqual(["R2", "R3"]);
    expect(first.z).toEqual({ c: "0", m: "12" });
    expect(stepsOf("radioterapia").at(-1)?.artificials).toEqual([]);
  });

  it("detecta los pivotes que no mueven el punto", () => {
    expect(stepsOf("ciclado-beale").some((step) => step.samePointAsNext)).toBe(true);
    expect(stepsOf("wyndor").some((step) => step.samePointAsNext)).toBe(false);
  });
});
