import pytest
from fastapi.testclient import TestClient

from app import solver
from app.main import app
from app.models import SolveResponse

client = TestClient(app)

WYNDOR = {
    "sense": "max",
    "objective": [3, 5],
    "constraints": [
        {"coefficients": [1, 0], "relation": "<=", "rhs": 4},
        {"coefficients": [0, 2], "relation": "<=", "rhs": 12},
        {"coefficients": [3, 2], "relation": "<=", "rhs": 18},
    ],
}


def with_changes(**changes):
    return {**WYNDOR, **changes}


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_solve_without_engine_returns_501():
    response = client.post("/api/solve", json=WYNDOR)
    assert response.status_code == 501
    assert "motor" in response.json()["detail"]


def test_solve_returns_contract_json(monkeypatch):
    """Cuando el motor exista, la API devuelve su respuesta en camelCase."""
    from tests.test_models import EXAMPLES

    stored = EXAMPLES[0]["response"]
    monkeypatch.setattr(solver, "solve", lambda problem: SolveResponse.model_validate(stored))
    response = client.post("/api/solve", json=WYNDOR)
    assert response.status_code == 200
    assert response.json() == stored


@pytest.mark.parametrize(
    ("body", "message"),
    [
        (with_changes(sense="maximo"), "El sentido de la optimización (max o min) tiene un valor no permitido."),
        (with_changes(objective=[]), "El número de variables debe estar entre 1 y 20."),
        (with_changes(objective=[3, "abc"]), "El coeficiente de x2 en la función objetivo debe ser un número."),
        (with_changes(constraints=[]), "El número de restricciones debe estar entre 1 y 20."),
        (
            with_changes(constraints=[{"coefficients": [1], "relation": "<=", "rhs": 4}]),
            "La restricción 1 tiene 1 coeficientes, pero la función objetivo tiene 2 variables.",
        ),
        (
            with_changes(constraints=[{"coefficients": [1, 0], "relation": "<", "rhs": 4}]),
            "El tipo de restricción de la restricción 1 tiene un valor no permitido.",
        ),
        (
            with_changes(constraints=[{"coefficients": [1, 0], "relation": "<="}]),
            "Falta el lado derecho de la restricción 1.",
        ),
        (
            with_changes(constraints=[{"coefficients": [1, None], "relation": "<=", "rhs": 4}]),
            "El coeficiente de x2 en la restricción 1 debe ser un número.",
        ),
    ],
)
def test_invalid_problems_get_spanish_messages(body, message):
    response = client.post("/api/solve", json=body)
    assert response.status_code == 422
    assert response.json()["detail"] == message


def test_negative_rhs_is_accepted():
    body = with_changes(constraints=[{"coefficients": [-1, -2], "relation": ">=", "rhs": -4}])
    assert client.post("/api/solve", json=body).status_code == 501
