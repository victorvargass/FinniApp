# Auditoría esencial de accesibilidad

Esta matriz se ejecuta con la candidata de lanzamiento en Android (TalkBack) e
iOS (VoiceOver). Las comprobaciones de código compartido se protegen con
`tests/accessibility-contract.test.mjs`.

## Cobertura incorporada

- Selectores compartidos anuncian etiqueta, valor, estado abierto/deshabilitado
  y la opción seleccionada.
- Navegación de períodos anuncia los botones no disponibles.
- Movimientos, filtros y leyendas de gráficos se presentan como acciones con
  nombre, monto y estado de selección.
- El selector de color expone cierre, campo hexadecimal, botones y estado
  deshabilitado.
- Acciones de Google Drive anuncian su estado mientras trabajan.
- Controles compartidos interactivos revisados mantienen un objetivo táctil de
  al menos 44 puntos.

## Verificación manual por candidata

| Caso | Android/TalkBack | iOS/VoiceOver |
| --- | --- | --- |
| Recorrer Inicio sin saltos ni foco atrapado | Pendiente | Pendiente |
| Crear ingreso y gasto solo con lector de pantalla | Pendiente | Pendiente |
| Elegir categoría, medio de pago y período | Pendiente | Pendiente |
| Completar formularios con teclado visible | Pendiente | Pendiente |
| Escala de fuente máxima sin acciones ocultas | Pendiente | Pendiente |
| Tema claro/oscuro y alto contraste del sistema | Pendiente | Pendiente |
| Cerrar modales y volver al control de origen | Pendiente | Pendiente |

Si un flujo no puede completarse sin mirar la pantalla, la candidata no se
promueve. La ejecución se registra junto al checklist de tienda y el modelo de
dispositivo usado.
