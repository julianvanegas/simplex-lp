/**
 * Contrato de datos entre el frontend y el futuro backend REST.
 * Los valores viajan como racionales exactos en texto ("2/5", "-3", "0").
 */
export type Rational = string;

/** Valor de la forma c + m·M, con M simbólica. */
export interface BigMValue {
  c: Rational;
  m: Rational;
}

export type Sense = "max" | "min";
export type Relation = "<=" | ">=" | "=";

export interface Constraint {
  coefficients: number[];
  relation: Relation;
  rhs: number;
}

export interface Problem {
  sense: Sense;
  objective: number[];
  constraints: Constraint[];
}

export type VariableKind = "decision" | "slack" | "excess" | "artificial";

export interface StandardForm {
  minToMax: boolean;
  objectiveTarget: "Z" | "-Z";
  variables: { name: string; kind: VariableKind; constraint: number | null }[];
  objective: { var: string; coef: BigMValue }[];
  constraints: {
    index: number;
    flipped: boolean;
    originalRelation: Relation;
    normalizedRelation: Relation;
    terms: { var: string; coef: Rational }[];
    rhs: Rational;
  }[];
  initialBasis: string[];
  row0BeforePricing: { coefficients: BigMValue[]; rhs: BigMValue };
  pricedOutRows: number[];
}

export interface TableauRow {
  equation: number;
  basic: string;
  coefficients: Rational[];
  rhs: Rational;
  ratio: Rational | null;
}

export interface Tableau {
  objectiveRow: { zCoefficient: 1 | -1; coefficients: BigMValue[]; rhs: BigMValue };
  rows: TableauRow[];
}

export interface PivotDecision {
  type: "pivot" | "alternate-pivot";
  rule: "dantzig" | "bland";
  entering: string;
  enteringColumn: number;
  enteringCost: BigMValue;
  leaving: string;
  pivotRow: number;
  pivotValue: Rational;
  minRatio: Rational;
  enteringTie: string[];
  leavingTie: string[];
  firstOptimal?: boolean;
}

export type Decision =
  | PivotDecision
  | { type: "optimal"; alternateEntering?: string }
  | { type: "alternate-optimal"; alternateEntering?: string }
  | { type: "infeasible"; artificials: string[] }
  | {
      type: "unbounded";
      entering: string;
      enteringColumn: number;
      enteringCost: BigMValue;
      enteringTie: string[];
    };

export type RowOperation =
  | { kind: "scale"; target: number; source: number; factor: Rational }
  | { kind: "eliminate"; target: number; source: number; factor: BigMValue };

export interface Iteration {
  index: number;
  phase: "main" | "alternate";
  tableau: Tableau;
  operations: RowOperation[] | null;
  basis: string[];
  decision: Decision;
}

export interface Solution {
  variables: { name: string; value: Rational }[];
  z: Rational;
  constraints: {
    index: number;
    lhs: Rational;
    relation: Relation;
    rhs: Rational;
    kind: "holgura" | "exceso" | "igualdad";
    amount: Rational;
  }[];
}

/** En los rangos, null equivale al 1E+30 de Solver de Excel (sin límite). */
export interface Sensitivity {
  variables: {
    name: string;
    finalValue: Rational;
    reducedCost: Rational;
    objectiveCoefficient: Rational;
    allowableIncrease: Rational | null;
    allowableDecrease: Rational | null;
  }[];
  constraints: {
    name: string;
    finalValue: Rational;
    shadowPrice: Rational;
    rhs: Rational;
    allowableIncrease: Rational | null;
    allowableDecrease: Rational | null;
  }[];
}

export interface GraphVertex {
  label: string;
  x1: Rational;
  x2: Rational;
  z: Rational;
  optimal: boolean;
  lines: string[];
}

export interface GraphPoint {
  x1: Rational;
  x2: Rational;
}

export interface GraphViewBounds {
  xMax: Rational;
  yMax: Rational;
}

export type Graphical =
  | { applicable: false }
  | {
      applicable: true;
      regionEmpty: boolean;
      regionBounded: boolean;
      vertices: GraphVertex[];
      infeasibleCorners: { x1: Rational; x2: Rational; z: Rational; lines: string[] }[];
      objectiveLine: { a: Rational; b: Rational; z: Rational } | null;
      status?: "optimal" | "infeasible" | "unbounded";
      multipleOptima?: boolean;
      viewBounds?: GraphViewBounds | null;
      regionPolygon?: GraphPoint[];
      cutPoints?: GraphPoint[];
    };

export interface SolveResponse {
  status: "optimal" | "infeasible" | "unbounded";
  multipleOptima: boolean;
  degenerate: boolean;
  degenerateIterations: number[];
  cycleDetectedAt: number | null;
  standardForm: StandardForm;
  iterations: Iteration[];
  solution: Solution | null;
  alternateSolution: Solution | null;
  optimalRay: Rational[] | null;
  sensitivity: Sensitivity | null;
  graphical: Graphical;
}

export interface Example {
  id: string;
  title: string;
  description: string;
  source: string;
  problem: Problem;
  response: SolveResponse;
}
