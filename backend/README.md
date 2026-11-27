# SimpleX LP · Backend

API REST en Python con FastAPI. Recibe un problema de programación lineal y devuelve la solución por el método de la Gran M con todo el paso a paso, el método gráfico y el análisis de sensibilidad, en el formato que espera el frontend (`frontend/src/lib/contract.ts`).

## Requisitos

- Python 3.11 o superior

## Instalación

Desde la carpeta `backend/`:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements-dev.txt
```

`requirements.txt` tiene lo necesario para ejecutar la API; `requirements-dev.txt` agrega lo de las pruebas.

## Ejecución

```bash
uvicorn app.main:app --reload --port 8000
```

- `GET  http://localhost:8000/api/health` → `{"status": "ok"}`
- `POST http://localhost:8000/api/solve` → recibe un `Problem` y devuelve un `SolveResponse`
- Documentación interactiva: `http://localhost:8000/docs`

Variable de entorno opcional: `ALLOWED_ORIGINS`, lista separada por comas de los orígenes que pueden llamar a la API (por defecto `http://localhost:3000`). En producción se pone la URL del frontend desplegado.

## Pruebas

```bash
pytest
```

`tests/test_models.py` comprueba que los modelos leen y vuelven a escribir, sin cambios, las 12 respuestas guardadas en `frontend/src/data/examples.json`.

## Estructura

| Archivo | Responsable | Contenido |
|---|---|---|
| `app/main.py` | C | App FastAPI, rutas, CORS y mensajes de error en español |
| `app/models.py` | C | Modelos Pydantic iguales a `contract.ts` |
| `app/solver.py` | A y B | Punto único que arma la respuesta completa |
| `app/rational.py` | A | Fracciones exactas y valores con M |
| `app/standard_form.py` | A | Forma estándar y renglón 0 |
| `app/simplex.py` | A | Iteraciones, casos especiales y solución |
| `app/graphical.py` | B | Vértices, región factible y recta de Z |
| `app/sensitivity.py` | B | Precios sombra, costos reducidos y rangos |
| `app/revised.py` | B | Simplex revisado (bonificación) |

## Cómo usar los modelos

En Python los campos van en snake_case y en el JSON salen en camelCase:

```python
from app.models import StandardForm

form = StandardForm(min_to_max=True, objective_target="-Z", ...)
form.model_dump(by_alias=True)  # {"minToMax": true, "objectiveTarget": "-Z", ...}
```

- Los valores exactos son texto: `"2/5"`, `"-3"`, `"0"`. Se calcula con `fractions.Fraction` y se convierte a texto al final; un decimal como `"0.4"` no pasa la validación.
- Los campos sin valor por defecto son obligatorios aunque valgan `None` (por ejemplo `ratio`): hay que pasarlos siempre. Los opcionales del contrato (`first_optimal`, `alternate_entering`) se omiten del JSON si no se asignan.
- Mientras `solver.solve` lance `NotImplementedError`, la API responde 501 y el frontend muestra el aviso de que no hay servidor de cálculo.

La rúbrica prohíbe usar scipy, PuLP u OR-Tools para producir resultados. scipy está en `requirements-dev.txt` solo para verificar en las pruebas.
