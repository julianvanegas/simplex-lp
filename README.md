# SimpleX LP

Aplicación web para resolver problemas de programación lineal por el **método de la Gran M**, mostrando el proceso completo: forma estándar, cada iteración del simplex, método gráfico y análisis de sensibilidad.

Proyecto del curso de Optimización, Universidad de Antioquia, 2026-2.

**Aplicación publicada:** _(se completa al desplegar)_
**API publicada:** _(se completa al desplegar)_

> El backend gratuito se duerme tras unos minutos sin uso. La primera vez puede tardar cerca de un minuto en responder; después responde de inmediato.

## Funciones

- Problemas de Max o Min con hasta 20 variables y 20 restricciones de tipo ≤, ≥ o =, con lados derechos de cualquier signo. Se valida cada dato con mensajes claros.
- Solución directa (solo el resultado) o paso a paso: forma estándar con holguras, excesos y artificiales, y en cada iteración la variable que entra, la prueba de la razón mínima, la que sale, el pivote y el tablero.
- Valores exactos en fracciones o, si se prefiere, en decimales.
- Método gráfico para dos variables: región factible, vértices con su valor de Z y recta de Z en el óptimo.
- Análisis de sensibilidad: precios sombra, costos reducidos y rangos de los coeficientes y de los lados derechos.
- Mensajes claros para problemas infactibles, no acotados, con óptimos múltiples o degenerados.
- Guardar y abrir problemas en archivos JSON, y exportar la solución paso a paso a PDF.

## Estructura

| Carpeta | Contenido |
|---|---|
| `frontend/` | Interfaz en Next.js, React y TypeScript. Ver [frontend/README.md](frontend/README.md). |
| `backend/` | API REST en Python con FastAPI y el motor de cálculo. Ver [backend/README.md](backend/README.md). |
| `render.yaml` | Configuración del despliegue del backend en Render. |

El contrato de datos entre las dos partes está en `frontend/src/lib/contract.ts` y se replica en `backend/app/models.py`.

## Requisitos

- Python 3.11 o superior
- Node.js 20.9 o superior

## Instalación y ejecución local

Se usan dos terminales, una para cada parte.

**1. Backend** (queda en `http://localhost:8000`):

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (queda en `http://localhost:3000`):

```bash
cd frontend
npm install
npm run dev
```

Luego se abre `http://localhost:3000`.

> En Windows, si PowerShell muestra «running scripts is disabled on this system», use `npm.cmd` en lugar de `npm` (por ejemplo `npm.cmd run dev`).

## Pruebas

```bash
cd backend && pytest
cd frontend && npm test
```

## Despliegue

- **Backend en Render:** *New → Blueprint* y se elige este repositorio; `render.yaml` define el servicio. En sus variables de entorno, `ALLOWED_ORIGINS` lleva la URL del frontend.
- **Frontend en Vercel:** se importa el repositorio con *Root Directory* `frontend` y la variable `NEXT_PUBLIC_API_URL` con la URL del backend.

Los dos se publican de nuevo automáticamente con cada cambio que entra a `main`.

## Equipo

| Integrante | Parte |
|---|---|
| _(nombre)_ | Motor de la Gran M |
| Samuel Castaño | Sensibilidad, método gráfico y simplex revisado |
| Julián Quintero | API, integración, interfaz y bonificaciones |
