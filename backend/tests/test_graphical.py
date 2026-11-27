"""Pruebas del cálculo gráfico contra los ejemplos y casos límite del contrato."""

import json
from pathlib import Path

import pytest

from app.graphical import build_graphical
from app.models import Problem

EXAMPLES_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "examples.json"
EXAMPLES = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))["examples"]
TWO_VARIABLE_EXAMPLES = [example for example in EXAMPLES if len(example["problem"]["objective"]) == 2]


@pytest.mark.parametrize("example", TWO_VARIABLE_EXAMPLES, ids=[example["id"] for example in TWO_VARIABLE_EXAMPLES])
def test_graphical_output_matches_frontend_examples(example):
    result = build_graphical(Problem.model_validate(example["problem"]))
    assert result.model_dump(mode="json", by_alias=True) == example["response"]["graphical"]


def test_graph_is_not_applicable_unless_there_are_two_variables():
    problem = Problem.model_validate(
        {
            "sense": "max",
            "objective": [1],
            "constraints": [{"coefficients": [1], "relation": "<=", "rhs": 2}],
        }
    )
    assert build_graphical(problem).model_dump(mode="json", by_alias=True) == {"applicable": False}


def test_unbounded_region_can_still_have_a_finite_optimum():
    problem = Problem.model_validate(
        {
            "sense": "max",
            "objective": [1, 0],
            "constraints": [{"coefficients": [1, 0], "relation": "<=", "rhs": 4}],
        }
    )
    result = build_graphical(problem)
    assert result.region_bounded is False
    assert result.objective_line.model_dump(mode="json", by_alias=True) == {"a": "1", "b": "0", "z": "4"}
    assert [vertex.label for vertex in result.vertices if vertex.optimal] == ["A"]
