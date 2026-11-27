"""Modelos del contrato entre el frontend y el backend.

Replican uno a uno los tipos de `frontend/src/lib/contract.ts`. En Python los
campos se escriben en snake_case (`min_to_max`) y en el JSON salen en camelCase
(`minToMax`), igual que en el frontend.

Reglas para quien construya estos objetos (motor, sensibilidad, gráfico):

- Los valores exactos (`Rational`) son texto: "2/5", "-3", "0". Use
  `fractions.Fraction` para calcular y conviértalo a texto solo al final.
- Los campos sin valor por defecto son obligatorios, aunque valgan None: hay que
  pasarlos siempre. Los pocos que tienen `= None` (por ejemplo `first_optimal`)
  son opcionales en el contrato y se omiten del JSON si no se asignan.
"""

from __future__ import annotations

import math
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from pydantic.alias_generators import to_camel

MAX_DIMENSION = 20
"""Máximo de variables y de restricciones; el mismo límite que usa el frontend."""

Rational = Annotated[str, StringConstraints(pattern=r"^-?\d+(/\d+)?$")]
"""Racional exacto en texto: "2/5", "-3", "0"."""


class ContractModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---------------------------------------------------------------- entrada

Sense = Literal["max", "min"]
Relation = Literal["<=", ">=", "="]


class Constraint(ContractModel):
    coefficients: list[float]
    relation: Relation
    rhs: float


class Problem(ContractModel):
    """Problema tal como lo envía el formulario del frontend."""

    sense: Sense
    objective: list[float]
    constraints: list[Constraint]

    @field_validator("objective")
    @classmethod
    def check_objective(cls, objective: list[float]) -> list[float]:
        if not 1 <= len(objective) <= MAX_DIMENSION:
            raise ValueError(f"El número de variables debe estar entre 1 y {MAX_DIMENSION}.")
        for j, value in enumerate(objective):
            if not math.isfinite(value):
                raise ValueError(f"El coeficiente de x{j + 1} en la función objetivo no es un número válido.")
        return objective

    @field_validator("constraints")
    @classmethod
    def check_constraint_count(cls, constraints: list[Constraint]) -> list[Constraint]:
        if not 1 <= len(constraints) <= MAX_DIMENSION:
            raise ValueError(f"El número de restricciones debe estar entre 1 y {MAX_DIMENSION}.")
        return constraints

    @model_validator(mode="after")
    def check_dimensions(self) -> Problem:
        n = len(self.objective)
        for i, constraint in enumerate(self.constraints, start=1):
            if len(constraint.coefficients) != n:
                raise ValueError(
                    f"La restricción {i} tiene {len(constraint.coefficients)} coeficientes, "
                    f"pero la función objetivo tiene {n} variables."
                )
            for j, value in enumerate(constraint.coefficients, start=1):
                if not math.isfinite(value):
                    raise ValueError(f"El coeficiente de x{j} en la restricción {i} no es un número válido.")
            if not math.isfinite(constraint.rhs):
                raise ValueError(f"El lado derecho de la restricción {i} no es un número válido.")
        return self


# ---------------------------------------------------------------- forma estándar

VariableKind = Literal["decision", "slack", "excess", "artificial"]


class BigMValue(ContractModel):
    """Valor de la forma c + m·M, con M simbólica."""

    c: Rational
    m: Rational


class StandardVariable(ContractModel):
    name: str
    kind: VariableKind
    constraint: int | None


class ObjectiveTerm(ContractModel):
    var: str
    coef: BigMValue


class Term(ContractModel):
    var: str
    coef: Rational


class StandardConstraint(ContractModel):
    index: int
    flipped: bool
    original_relation: Relation
    normalized_relation: Relation
    terms: list[Term]
    rhs: Rational


class ObjectiveRow(ContractModel):
    coefficients: list[BigMValue]
    rhs: BigMValue


class StandardForm(ContractModel):
    min_to_max: bool
    objective_target: Literal["Z", "-Z"]
    variables: list[StandardVariable]
    objective: list[ObjectiveTerm]
    constraints: list[StandardConstraint]
    initial_basis: list[str]
    row0_before_pricing: ObjectiveRow
    priced_out_rows: list[int]


# ---------------------------------------------------------------- iteraciones


class TableauRow(ContractModel):
    equation: int
    basic: str
    coefficients: list[Rational]
    rhs: Rational
    ratio: Rational | None


class TableauObjectiveRow(ContractModel):
    z_coefficient: Literal[1, -1]
    coefficients: list[BigMValue]
    rhs: BigMValue


class Tableau(ContractModel):
    objective_row: TableauObjectiveRow
    rows: list[TableauRow]


class PivotDecision(ContractModel):
    type: Literal["pivot", "alternate-pivot"]
    rule: Literal["dantzig", "bland"]
    entering: str
    entering_column: int
    entering_cost: BigMValue
    leaving: str
    pivot_row: int
    pivot_value: Rational
    min_ratio: Rational
    entering_tie: list[str]
    leaving_tie: list[str]
    first_optimal: bool | None = None


class OptimalDecision(ContractModel):
    type: Literal["optimal", "alternate-optimal"]
    alternate_entering: str | None = None


class InfeasibleDecision(ContractModel):
    type: Literal["infeasible"]
    artificials: list[str]


class UnboundedDecision(ContractModel):
    type: Literal["unbounded"]
    entering: str
    entering_column: int
    entering_cost: BigMValue
    entering_tie: list[str]


Decision = Annotated[
    Union[PivotDecision, OptimalDecision, InfeasibleDecision, UnboundedDecision],
    Field(discriminator="type"),
]


class ScaleOperation(ContractModel):
    kind: Literal["scale"]
    target: int
    source: int
    factor: Rational


class EliminateOperation(ContractModel):
    kind: Literal["eliminate"]
    target: int
    source: int
    factor: BigMValue


RowOperation = Annotated[Union[ScaleOperation, EliminateOperation], Field(discriminator="kind")]


class Iteration(ContractModel):
    index: int
    phase: Literal["main", "alternate"]
    tableau: Tableau
    operations: list[RowOperation] | None
    basis: list[str]
    decision: Decision


# ---------------------------------------------------------------- solución


class VariableValue(ContractModel):
    name: str
    value: Rational


class ConstraintResult(ContractModel):
    index: int
    lhs: Rational
    relation: Relation
    rhs: Rational
    kind: Literal["holgura", "exceso", "igualdad"]
    amount: Rational


class Solution(ContractModel):
    variables: list[VariableValue]
    z: Rational
    constraints: list[ConstraintResult]


# ---------------------------------------------------------------- sensibilidad


class VariableSensitivity(ContractModel):
    name: str
    final_value: Rational
    reduced_cost: Rational
    objective_coefficient: Rational
    allowable_increase: Rational | None
    """None equivale al 1E+30 del Solver de Excel (sin límite)."""
    allowable_decrease: Rational | None


class ConstraintSensitivity(ContractModel):
    name: str
    final_value: Rational
    shadow_price: Rational
    rhs: Rational
    allowable_increase: Rational | None
    allowable_decrease: Rational | None


class Sensitivity(ContractModel):
    variables: list[VariableSensitivity]
    constraints: list[ConstraintSensitivity]


# ---------------------------------------------------------------- método gráfico


class GraphVertex(ContractModel):
    label: str
    x1: Rational
    x2: Rational
    z: Rational
    optimal: bool
    lines: list[str]


class InfeasibleCorner(ContractModel):
    x1: Rational
    x2: Rational
    z: Rational
    lines: list[str]


class ObjectiveLine(ContractModel):
    a: Rational
    b: Rational
    z: Rational


class GraphPoint(ContractModel):
    x1: Rational
    x2: Rational


class GraphViewBounds(ContractModel):
    x_max: Rational
    y_max: Rational


class GraphNotApplicable(ContractModel):
    applicable: Literal[False]


class GraphApplicable(ContractModel):
    applicable: Literal[True]
    region_empty: bool
    region_bounded: bool
    vertices: list[GraphVertex]
    infeasible_corners: list[InfeasibleCorner]
    objective_line: ObjectiveLine | None
    status: Literal["optimal", "infeasible", "unbounded"] = "optimal"
    multiple_optima: bool = False
    view_bounds: GraphViewBounds | None = None
    region_polygon: list[GraphPoint] = Field(default_factory=list)
    cut_points: list[GraphPoint] = Field(default_factory=list)


Graphical = Annotated[Union[GraphNotApplicable, GraphApplicable], Field(discriminator="applicable")]


# ---------------------------------------------------------------- respuesta


class SolveResponse(ContractModel):
    status: Literal["optimal", "infeasible", "unbounded"]
    multiple_optima: bool
    degenerate: bool
    degenerate_iterations: list[int]
    cycle_detected_at: int | None
    standard_form: StandardForm
    iterations: list[Iteration]
    solution: Solution | None
    alternate_solution: Solution | None
    optimal_ray: list[Rational] | None
    sensitivity: Sensitivity | None
    graphical: Graphical
