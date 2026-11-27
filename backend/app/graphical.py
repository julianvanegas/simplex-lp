"""Cálculo exacto de la región factible para problemas con dos variables."""

from __future__ import annotations

from functools import cmp_to_key
from fractions import Fraction
from typing import TypeAlias

from .models import (
    Constraint,
    GraphApplicable,
    GraphNotApplicable,
    GraphPoint,
    Graphical,
    GraphViewBounds,
    GraphVertex,
    InfeasibleCorner,
    ObjectiveLine,
    Problem,
)

Point: TypeAlias = tuple[Fraction, Fraction]
Line: TypeAlias = tuple[Fraction, Fraction, Fraction, str]


def _fraction(value: float) -> Fraction:
    """Interpreta el valor decimal recibido sin arrastrar su error binario."""
    return Fraction(str(value))


def _rational(value: Fraction) -> str:
    """Serializa una fracción con la forma exacta del contrato."""
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def _intersection(first: Line, second: Line) -> Point | None:
    """Resuelve dos rectas; devuelve None si son paralelas o coincidentes."""
    a1, b1, rhs1, _ = first
    a2, b2, rhs2, _ = second
    determinant = a1 * b2 - a2 * b1
    if determinant == 0:
        return None
    return (
        (rhs1 * b2 - rhs2 * b1) / determinant,
        (a1 * rhs2 - a2 * rhs1) / determinant,
    )


def _satisfies(constraint: Constraint, point: Point) -> bool:
    a, b = (_fraction(value) for value in constraint.coefficients)
    lhs = a * point[0] + b * point[1]
    rhs = _fraction(constraint.rhs)
    if constraint.relation == "<=":
        return lhs <= rhs
    if constraint.relation == ">=":
        return lhs >= rhs
    return lhs == rhs


def _active_lines(constraints: list[Constraint], point: Point) -> list[str]:
    lines = []
    for index, constraint in enumerate(constraints, start=1):
        a, b = (_fraction(value) for value in constraint.coefficients)
        if a * point[0] + b * point[1] == _fraction(constraint.rhs):
            lines.append(f"R{index}")
    if point[0] == 0:
        lines.append("x1=0")
    if point[1] == 0:
        lines.append("x2=0")
    return lines


def _compare_around_centroid(first: Point, second: Point, center: Point) -> int:
    """Compara ángulos en [-pi, pi] usando solo operaciones racionales."""
    first_vector = (first[0] - center[0], first[1] - center[1])
    second_vector = (second[0] - center[0], second[1] - center[1])

    def half(vector: Point) -> int:
        return 0 if vector[1] < 0 else 1

    first_half = half(first_vector)
    second_half = half(second_vector)
    if first_half != second_half:
        return -1 if first_half < second_half else 1

    cross = first_vector[0] * second_vector[1] - first_vector[1] * second_vector[0]
    if cross:
        return -1 if cross > 0 else 1
    dot = first_vector[0] * second_vector[0] + first_vector[1] * second_vector[1]
    if dot < 0:
        return -1 if first_vector[0] > 0 else 1
    return (first > second) - (first < second)


def _sort_vertices(points: list[Point]) -> list[Point]:
    if len(points) < 2:
        return points
    center = (
        sum((point[0] for point in points), Fraction()) / len(points),
        sum((point[1] for point in points), Fraction()) / len(points),
    )
    return sorted(points, key=cmp_to_key(lambda a, b: _compare_around_centroid(a, b, center)))


def _recession_interval(constraints: list[Constraint]) -> tuple[Fraction, Fraction] | None:
    """Busca direcciones no nulas d=(t, 1-t) de la región de recesión."""
    lower, upper = Fraction(0), Fraction(1)
    for constraint in constraints:
        a, b = (_fraction(value) for value in constraint.coefficients)
        # a*t + b*(1-t) = b + (a-b)*t
        slope = a - b
        intercept = b
        relation = constraint.relation

        if relation == "=":
            if slope == 0:
                if intercept != 0:
                    return None
                continue
            value = -intercept / slope
            if value < lower or value > upper:
                return None
            lower = upper = value
            continue

        # For <=, negate the expression so both inequalities use >= 0.
        if relation == "<=":
            slope, intercept = -slope, -intercept

        if slope == 0:
            if intercept < 0:
                return None
        elif slope > 0:
            lower = max(lower, -intercept / slope)
        else:
            upper = min(upper, -intercept / slope)
        if lower > upper:
            return None
    return lower, upper


def _objective_improves_along_recession(
    interval: tuple[Fraction, Fraction],
    objective: tuple[Fraction, Fraction],
    sense: str,
) -> bool:
    c1, c2 = objective
    lower, upper = interval
    values = (c2 + (c1 - c2) * lower, c2 + (c1 - c2) * upper)
    if sense == "max":
        return max(values) > 0
    return min(values) < 0


def _clip_half_plane(
    polygon: list[Point],
    a: Fraction,
    b: Fraction,
    rhs: Fraction,
) -> list[Point]:
    """Recorta un polígono al semiplano a*x1 + b*x2 <= rhs."""
    if not polygon:
        return []

    clipped: list[Point] = []
    for index, current in enumerate(polygon):
        following = polygon[(index + 1) % len(polygon)]
        current_value = a * current[0] + b * current[1] - rhs
        following_value = a * following[0] + b * following[1] - rhs

        if current_value <= 0:
            clipped.append(current)
        if (current_value < 0 < following_value) or (following_value < 0 < current_value):
            ratio = current_value / (current_value - following_value)
            clipped.append(
                (
                    current[0] + ratio * (following[0] - current[0]),
                    current[1] + ratio * (following[1] - current[1]),
                )
            )

    deduplicated: list[Point] = []
    for point in clipped:
        if not deduplicated or point != deduplicated[-1]:
            deduplicated.append(point)
    if len(deduplicated) > 1 and deduplicated[0] == deduplicated[-1]:
        deduplicated.pop()
    return deduplicated


def _clipped_region(constraints: list[Constraint], x_max: Fraction, y_max: Fraction) -> list[Point]:
    """Obtiene el polígono factible recortado al rectángulo visible."""
    polygon = [
        (Fraction(0), Fraction(0)),
        (x_max, Fraction(0)),
        (x_max, y_max),
        (Fraction(0), y_max),
    ]
    for constraint in constraints:
        a, b = (_fraction(value) for value in constraint.coefficients)
        rhs = _fraction(constraint.rhs)
        polygon = _clip_half_plane(polygon, a, b, rhs)
        if constraint.relation == ">=":
            polygon = _clip_half_plane(polygon, -a, -b, -rhs)
        elif constraint.relation == "=":
            polygon = _clip_half_plane(polygon, -a, -b, -rhs)
        if not polygon:
            break
    return polygon


def _label(index: int) -> str:
    """Genera etiquetas A..Z, AA..AZ, etc."""
    result = ""
    while index >= 0:
        index, remainder = divmod(index, 26)
        result = chr(ord("A") + remainder) + result
        index -= 1
    return result


def build_graphical(problem: Problem) -> Graphical:
    """Construye el resultado del método gráfico según el contrato del frontend."""
    if len(problem.objective) != 2:
        return GraphNotApplicable(applicable=False)

    objective = tuple(_fraction(value) for value in problem.objective)
    constraints = problem.constraints
    lines: list[Line] = [
        (
            _fraction(constraint.coefficients[0]),
            _fraction(constraint.coefficients[1]),
            _fraction(constraint.rhs),
            f"R{index}",
        )
        for index, constraint in enumerate(constraints, start=1)
        if constraint.coefficients[0] != 0 or constraint.coefficients[1] != 0
    ]
    lines.extend(
        [
            (Fraction(1), Fraction(0), Fraction(0), "x1=0"),
            (Fraction(0), Fraction(1), Fraction(0), "x2=0"),
        ]
    )

    # Las únicas esquinas posibles son intersecciones de dos fronteras.
    candidates: set[Point] = set()
    for index, first in enumerate(lines):
        for second in lines[index + 1 :]:
            point = _intersection(first, second)
            if point is not None and point[0] >= 0 and point[1] >= 0:
                candidates.add(point)

    feasible = [
        point
        for point in candidates
        if all(_satisfies(constraint, point) for constraint in constraints)
    ]
    infeasible = sorted(candidates.difference(feasible))

    recession_interval = _recession_interval(constraints)
    region_bounded = recession_interval is None
    objective_unbounded = (
        recession_interval is not None
        and _objective_improves_along_recession(recession_interval, objective, problem.sense)
    )
    status = "infeasible" if not feasible else "unbounded" if objective_unbounded else "optimal"
    has_optimum = status == "optimal"

    values = {
        point: objective[0] * point[0] + objective[1] * point[1]
        for point in feasible
    }
    best_value: Fraction | None = None
    optimal_points: set[Point] = set()
    if has_optimum:
        best_value = (max if problem.sense == "max" else min)(values.values())
        optimal_points = {point for point, value in values.items() if value == best_value}

    ordered_vertices = _sort_vertices(feasible)
    multiple_optima = has_optimum and len(ordered_vertices) > 1 and any(
        first in optimal_points and second in optimal_points and values[first] == values[second]
        for first, second in zip(ordered_vertices, ordered_vertices[1:] + ordered_vertices[:1])
    )
    vertices = [
        GraphVertex(
            label=_label(index),
            x1=_rational(point[0]),
            x2=_rational(point[1]),
            z=_rational(values[point]),
            optimal=point in optimal_points,
            lines=_active_lines(constraints, point),
        )
        for index, point in enumerate(ordered_vertices)
    ]
    infeasible_corners = [
        InfeasibleCorner(
            x1=_rational(point[0]),
            x2=_rational(point[1]),
            z=_rational(objective[0] * point[0] + objective[1] * point[1]),
            lines=_active_lines(constraints, point),
        )
        for point in infeasible
    ]
    objective_line = (
        ObjectiveLine(
            a=_rational(objective[0]),
            b=_rational(objective[1]),
            z=_rational(best_value),
        )
        if best_value is not None
        else None
    )
    x_max = max(Fraction(1), *(point[0] for point in candidates)) * Fraction(6, 5)
    y_max = max(Fraction(1), *(point[1] for point in candidates)) * Fraction(6, 5)
    region_polygon = _clipped_region(constraints, x_max, y_max) if feasible else []
    cut_points = [
        point
        for point in region_polygon
        if point[0] == x_max or point[1] == y_max
    ]

    return GraphApplicable(
        applicable=True,
        region_empty=not feasible,
        region_bounded=region_bounded,
        vertices=vertices,
        infeasible_corners=infeasible_corners,
        objective_line=objective_line,
        status=status,
        multiple_optima=multiple_optima,
        view_bounds=GraphViewBounds(x_max=_rational(x_max), y_max=_rational(y_max)),
        region_polygon=[GraphPoint(x1=_rational(x), x2=_rational(y)) for x, y in region_polygon],
        cut_points=[GraphPoint(x1=_rational(x), x2=_rational(y)) for x, y in cut_points],
    )


if __name__ == "__main__":
    import json
    from pathlib import Path

    examples_path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "examples.json"
    examples = json.loads(examples_path.read_text(encoding="utf-8"))["examples"]
    checked = 0
    for example in examples:
        problem = Problem.model_validate(example["problem"])
        expected = example["response"]["graphical"]
        actual = build_graphical(problem)
        serialized = actual.model_dump(mode="json", by_alias=True)
        assert {key: serialized[key] for key in expected} == expected, example["id"]
        if actual.applicable:
            assert actual.status == example["response"]["status"], example["id"]
            assert actual.multiple_optima == example["response"]["multipleOptima"], example["id"]
        checked += 1
    print(f"OK: {checked} ejemplos de examples.json verificados.")
