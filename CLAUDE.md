# Reglas de trabajo

Al empezar cada sesión, leé `docs/PLAN.md`. Se trabaja una etapa por vez y no se avanza hasta cumplir su criterio.

- Todo texto visible para el jugador va en español y vive en `src/data/texts.ts`.
- TypeScript estricto. `npm run build` debe terminar sin errores de tipos y `npm test` (vitest, pruebas de la simulación) debe pasar.
- La simulación (`src/sim/`) y el estado (`src/core/`) no importan nada de PixiJS ni del DOM. El dibujo (`src/render/`) y la interfaz (`src/ui/`) solo leen el estado.
- Todos los números de balance y configuración (costos, radios, capacidades, colores, tamaños) van en `src/data/`.
- Interfaz con HTML y CSS planos encima del canvas. Sin librerías de UI ni de cámara.
- Al terminar una etapa: explicar qué probar y qué se debería ver, y hacer un commit.
- Sprites: hojas de Kenney en `public/assets/kenney/`, convertidas con `scripts/kenney-atlas.mjs`. Qué sprite se usa para cada cosa está en `src/data/sprites.ts`. La carpeta `kenney/` (ZIP originales) no va al repositorio.
- Interfaz: todos los colores, tipografías, radios, sombras y espaciados salen de las variables de `src/ui/theme.css`; no se escriben colores sueltos en el CSS. Nada de emojis: los íconos son SVG de Lucide en `src/ui/icons/` (origen y licencia en `LICENSES.md`). Todo botón tiene nombre visible o ayuda emergente (`src/ui/tooltip.ts`), y lo bloqueado explica qué hace falta para desbloquearlo.
- Vista de prueba de vehículos (solo en desarrollo): `http://localhost:5173/?prueba=vehiculos`.
