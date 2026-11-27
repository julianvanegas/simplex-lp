"""API REST de SimpleX LP.

Ejecutar desde la carpeta `backend/`:

    uvicorn app.main:app --reload --port 8000
"""

import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import solver
from .models import Problem, SolveResponse

DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"

app = FastAPI(
    title="SimpleX LP",
    description="Resuelve problemas de programación lineal por el método de la Gran M.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    # En producción se define ALLOWED_ORIGINS con la URL del frontend desplegado.
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()],
    # Opcional: expresión regular para las vistas previas de Vercel, que cambian en cada PR.
    allow_origin_regex=os.getenv("ALLOWED_ORIGIN_REGEX") or None,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------- errores en español

FIELD_NAMES = {
    "sense": "el sentido de la optimización (max o min)",
    "objective": "la función objetivo",
    "constraints": "las restricciones",
    "coefficients": "los coeficientes",
    "relation": "el tipo de restricción",
    "rhs": "el lado derecho",
}


def describe_location(loc: tuple) -> str:
    """Convierte ('body', 'constraints', 1, 'rhs') en 'el lado derecho de la restricción 2'."""
    parts = [p for p in loc if p != "body"]
    if not parts:
        return "el problema"
    if parts[0] == "objective" and len(parts) > 1 and isinstance(parts[1], int):
        return f"el coeficiente de x{parts[1] + 1} en la función objetivo"
    if parts[0] == "constraints" and len(parts) > 1 and isinstance(parts[1], int):
        where = f"la restricción {parts[1] + 1}"
        if len(parts) > 3 and parts[2] == "coefficients" and isinstance(parts[3], int):
            return f"el coeficiente de x{parts[3] + 1} en {where}"
        if len(parts) > 2:
            return f"{FIELD_NAMES.get(parts[2], parts[2])} de {where}"
        return where
    return FIELD_NAMES.get(parts[-1], str(parts[-1]))


def translate_error(error: dict) -> str:
    kind = error["type"]
    where = describe_location(tuple(error["loc"]))
    if kind == "value_error":
        return str(error["msg"]).removeprefix("Value error, ")
    if kind == "missing":
        return f"Falta {where}."
    if kind in ("float_parsing", "float_type", "finite_number"):
        return f"{where[0].upper()}{where[1:]} debe ser un número."
    if kind == "literal_error":
        return f"{where[0].upper()}{where[1:]} tiene un valor no permitido."
    if kind in ("list_type", "model_type", "model_attributes_type", "dict_type"):
        return f"{where[0].upper()}{where[1:]} no tiene el formato esperado."
    if kind == "json_invalid":
        return "El cuerpo de la petición no es un JSON válido."
    return f"{where[0].upper()}{where[1:]}: dato no válido."


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    messages = list(dict.fromkeys(translate_error(e) for e in exc.errors()))
    return JSONResponse(status_code=422, content={"detail": messages[0], "errors": messages})


# ---------------------------------------------------------------- rutas


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post(
    "/api/solve",
    response_model=SolveResponse,
    response_model_by_alias=True,
    # Omite solo los campos opcionales del contrato que no se asignaron
    # (firstOptimal, alternateEntering); los null obligatorios sí se envían.
    response_model_exclude_unset=True,
)
def solve(problem: Problem):
    try:
        return solver.solve(problem)
    except NotImplementedError as error:
        return JSONResponse(status_code=501, content={"detail": str(error)})
