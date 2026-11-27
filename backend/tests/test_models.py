"""Los modelos de Python deben aceptar exactamente el contrato del frontend.

Se valida contra `frontend/src/data/examples.json`: cada respuesta guardada se
lee con los modelos y, al volverla a escribir, debe quedar idéntica.
"""

import json
from pathlib import Path

import pytest

from app.models import Problem, SolveResponse

EXAMPLES_PATH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "examples.json"
EXAMPLES = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))["examples"]


@pytest.mark.parametrize("example", EXAMPLES, ids=[e["id"] for e in EXAMPLES])
def test_problem_is_valid(example):
    problem = Problem.model_validate(example["problem"])
    assert len(problem.constraints) == len(example["problem"]["constraints"])


@pytest.mark.parametrize("example", EXAMPLES, ids=[e["id"] for e in EXAMPLES])
def test_response_round_trip(example):
    response = SolveResponse.model_validate(example["response"])
    assert response.model_dump(mode="json", by_alias=True, exclude_unset=True) == example["response"]


def test_python_names_are_snake_case():
    response = SolveResponse.model_validate(EXAMPLES[0]["response"])
    assert response.standard_form.min_to_max is False
    assert response.standard_form.row0_before_pricing.rhs.c == "0"


def test_rational_rejects_decimals():
    data = json.loads(json.dumps(EXAMPLES[0]["response"]))
    data["solution"]["z"] = "36.0"
    with pytest.raises(ValueError):
        SolveResponse.model_validate(data)
