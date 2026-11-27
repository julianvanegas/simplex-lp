"""Punto único de entrada al cálculo.

`solve` recibe el problema ya validado y arma la respuesta completa del
contrato. Cada parte la aporta un módulo:

- Estudiante A: `standard_form.py` y `simplex.py` (forma estándar, iteraciones,
  casos especiales y solución). Expone `solve_big_m(problem)`, que devuelve las
  partes de la respuesta y el estado final (forma estándar, tablero final, base
  y lista de variables) que usa la sensibilidad.
- Estudiante B: `sensitivity.py` (a partir del estado final de A) y
  `graphical.py` (a partir del problema).

Mientras el motor no exista, `solve` lanza `NotImplementedError` y la API
responde 501, para que el frontend ya pueda conectarse y mostrar el aviso.
"""

from .models import Problem, SolveResponse


def solve(problem: Problem) -> SolveResponse:
    raise NotImplementedError("El motor de cálculo todavía no está implementado.")
