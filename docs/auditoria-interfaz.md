# Auditoría de la interfaz y de los vehículos

Fecha: 2026-10-09

## Qué se encontró

1. `src/ui/styles.css` tiene unos 40 colores sueltos, paneles oscuros translúcidos y posiciones absolutas fijas (`top: 176px`, `bottom: 86px`). Por eso el panel de mapas pisa al de demanda y la ayuda pisa la barra inferior.
2. Hay emojis usados como íconos en la barra superior, los servicios (`src/data/services.ts`), las alertas, el ánimo, el hito, el candado de bloqueo y los avisos del panel de información.
3. Los íconos sobre los edificios son texto emoji dentro de cada edificio (`src/render/buildingView.ts`). Siempre están visibles, no se adaptan al zoom y no se agrupan, así que se amontonan.
4. La única ayuda emergente es el atributo `title`. Los botones bloqueados usan `disabled`, que en Chrome y Edge impide que se vea el `title`: nunca explican por qué están bloqueados.
5. Las barras de demanda solo dicen "R/C/I". En la fila de recursos, la columna del nombre mide 62 px y corta el texto.
6. Las alertas son texto plano, sin destino ni acción.
7. Vehículos: el recorte del atlas (formato convertido de Kenney) es correcto, pero dos de las cuatro direcciones usaban cuadros en bajada (`010` y `014`), que se ven deformados. Los cuadros planos son `001` (NW), `003` (NE), `007` (SW) y `008` (SE), comparados contra el taxi, que sí trae nombres de dirección. El anclaje en el 75% del alto dejaba las ruedas despegadas del suelo.

## Qué se cambia

- `src/ui/theme.css` con variables (colores, tipografías, radios, sombras, espaciados). El resto del CSS usa solo esas variables.
- Íconos SVG de línea de Lucide copiados a `src/ui/icons/`, con licencia y origen anotados.
- Barra inferior agrupada por categorías (Caminos, Zonas, Servicios, Herramientas) con ayudas emergentes propias: nombre, costo, atajo, descripción y motivo del bloqueo.
- Layout en grilla con zonas fijas: barra superior, columna izquierda, columna derecha, centro libre y barra inferior.
- Capa de indicadores sobre el mapa, separada de los edificios: solo problemas, o todos desde cierto zoom; tamaño estable en pantalla y agrupación por cercanía.
- Alertas clickeables que llevan la cámara al problema o abren el presupuesto.
- Vehículos con los cuadros planos correctos, anclaje en las ruedas y una vista de prueba temporal.
