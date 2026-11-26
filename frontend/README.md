# SimpleX LP

Frontend en Next.js, React y TypeScript para resolver programación lineal con el método Simplex de la Gran M y el método gráfico. Se ejecuta con Node.js.

```bash
npm install
npm run dev
```

Otros comandos: `npm test`, `npm run lint`, `npm run build`.

## Estado actual: demostración

No hay backend todavía. `src/data/examples.json` guarda problemas ya resueltos. Si el problema escrito coincide con uno de ellos se muestra su resultado; si no, la interfaz informa que no pudo conectarse con el servidor de cálculo.

## Conexión con el backend

Solo hay que reemplazar el cuerpo de `solveProblem` en `src/lib/solverClient.ts` por la llamada REST. Debe recibir un `Problem` y devolver un `SolveResponse`, ambos definidos en `src/lib/contract.ts`.

Reglas del contrato:

- Los valores son racionales exactos en texto (`"2/5"`). Los del renglón 0 se envían como `{ "c": "2/5", "m": "-11/10" }`, que significa −11/10 M + 2/5.
- Minimizar se resuelve como Max −Z. Entra el coeficiente más negativo del renglón 0.
- Los empates se rompen por el menor subíndice. Si se repite una base, se aplica la regla de Bland.
- Variables con nombres `x`, `S` (holgura), `E` (exceso) y `R` (artificial). El número de `S`, `E` y `R` es el de su restricción.
- La sensibilidad se calcula sobre la Z original, como Solver de Excel. `null` en un rango significa sin límite y se muestra como `1E+30`.
