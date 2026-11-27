# SimpleX LP

Frontend en Next.js, React y TypeScript para resolver programación lineal con el método Simplex de la Gran M y el método gráfico. Se ejecuta con Node.js.

```bash
npm install
npm run dev
```

Otros comandos: `npm test`, `npm run lint`, `npm run build`.

## Conexión con el backend

`solveProblem` en `src/lib/solverClient.ts` envía el problema a `POST /api/solve` del backend (carpeta `backend/`). Recibe un `Problem` y devuelve un `SolveResponse`, ambos definidos en `src/lib/contract.ts`.

La dirección del backend se toma de `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:8000`). Para usar otra, créela antes de compilar o arrancar:

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_API_URL = "https://mi-backend.example.com"
# macOS / Linux
export NEXT_PUBLIC_API_URL=https://mi-backend.example.com
```

Si el backend no responde o todavía no tiene motor (501), los problemas que coinciden con uno de `src/data/examples.json` se muestran con su respuesta guardada; los demás muestran un aviso claro. Si el backend rechaza el problema (422), se muestra su mensaje.

Reglas del contrato:

- Los valores son racionales exactos en texto (`"2/5"`). Los del renglón 0 se envían como `{ "c": "2/5", "m": "-11/10" }`, que significa −11/10 M + 2/5.
- Minimizar se resuelve como Max −Z. Entra el coeficiente más negativo del renglón 0.
- Los empates se rompen por el menor subíndice. Si se repite una base, se aplica la regla de Bland.
- Variables con nombres `x`, `S` (holgura), `E` (exceso) y `R` (artificial). El número de `S`, `E` y `R` es el de su restricción.
- La sensibilidad se calcula sobre la Z original, como Solver de Excel. `null` en un rango significa sin límite y se muestra como `1E+30`.
