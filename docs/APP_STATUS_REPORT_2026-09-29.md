# Estado actual y plan de profesionalización de FinniApp

Fecha de revisión: 29 de septiembre de 2026  
Base revisada: Expo SDK 54, React Native 0.81, React 19, TypeScript, Expo Router y SQLite.  
Versión declarada: 1.0.0. Esquema local: v27.

## Resumen ejecutivo

FinniApp ya no es un prototipo simple de ingresos y gastos. Es una aplicación financiera local-first con un dominio amplio: períodos, movimientos, medios de pago, tarjetas y facturación, transferencias, ahorro, deudas por pagar y cobrar, contactos, recurrencias, notificaciones, reportes y respaldo en Google Drive.

La base funcional es sólida y tiene decisiones especialmente buenas para una app financiera: horas en los movimientos, saldos informados con anclas, transacciones SQLite, migraciones versionadas, validación estricta de respaldos, conciliación de tarjetas y pruebas para evitar duplicar cargos o saldos. La experiencia también ha madurado con modo oscuro, español e inglés, onboarding, accesibilidad básica, bandeja de notificaciones y personalización de Inicio.

Mi evaluación es **beta avanzada / candidata a una publicación controlada**, no todavía un producto masivo completamente profesionalizado. Lo que más falta no son nuevas funciones: son observabilidad, seguridad de datos en reposo y respaldos, pruebas de actualización en dispositivos reales, modularización interna y disciplina de lanzamiento.

## Evaluación por dimensión

| Dimensión | Estado | Evaluación |
| --- | --- | --- |
| Cobertura funcional | Muy alta | Resuelve la mayoría de los flujos financieros personales previstos. |
| Integridad financiera | Alta | Hay anclas temporales, conciliación, transacciones y casos de regresión específicos. |
| Experiencia de uso | Media-alta | Clara y consistente; aún requiere una auditoría completa de accesibilidad y escalabilidad visual. |
| Calidad automatizada | Alta para lógica, media para UI | 144 pruebas funcionales, 4 de migración y recorridos Maestro; falta ampliar dispositivos y plataformas. |
| Seguridad y privacidad | Media | Local-first y sin publicidad, pero SQLite y el respaldo no tienen cifrado extremo a extremo propio. |
| Mantenibilidad | Media | El dominio está probado, pero `lib/db.ts` y `DatabaseContext` concentran demasiadas responsabilidades. |
| Operación y soporte | Media-alta | Hay CI, EAS, OTA, diagnósticos y runbooks; falta monitoreo de fallos y una estrategia formal de soporte. |

## Funcionalidades actuales

### Inicio y períodos

- Período financiero configurable, navegación entre períodos y cierre con apertura ordenada del siguiente.
- Configuración de saldos iniciales al comenzar un período.
- Resumen de disponible, ingresos, gastos, pagos de tarjeta y ajustes.
- Secciones desplegables para Billetera, Cupos disponibles, Metas de ahorro, Deudas y pagos, y Desglose.
- Selección individual de qué medios de pago, tarjetas, metas, deudas y compras en cuotas aparecen en Inicio.
- Área “Requiere tu atención” para vencimientos de tarjeta, confirmaciones recurrentes, límites de categoría y saldos negativos.
- Descarte persistente de avisos de atención sin borrar el dato financiero que los originó; un evento materialmente nuevo vuelve a avisar.
- Resumen semanal, hitos de ahorro y guía de configuración progresiva.

### Ingresos, gastos y movimientos

- Creación y edición de ingresos y gastos con fecha y hora.
- Categorías separadas para ingresos y gastos, límites por categoría y búsquedas.
- División por monto o porcentaje, con asignación de cobros a contactos.
- Asociación con medios de pago y cálculo del impacto real en saldos o cupos.
- Filtros, agrupación y navegación desde resúmenes a movimientos relacionados.
- Accesos rápidos para gastos, ingresos, transferencias, abonos, ahorro y pagos/cobros de deudas.

### Medios de pago y tarjetas

- Efectivo, débito, prepago y crédito.
- Saldo o cupo informado, fecha y hora de sincronización, y cálculo de movimientos posteriores.
- Transferencias entre cuentas sin alterar el patrimonio total.
- Detalle de cuenta con cálculo explicable del saldo, acciones relevantes y movimientos recientes.
- Tarjetas con cupo total, cupo disponible, facturación, vencimiento, ciclos y conciliación.
- Abonos, devoluciones y ajustes sin duplicar gastos.
- Compras en cuotas con proyección, registro de cuotas reales, edición y liquidación anticipada.

### Ahorro

- Metas con monto objetivo, saldo inicial, ajustes, aportes y retiros opcionales.
- Agrupación por categorías de ahorro.
- Aportes manuales y recurrentes asociados a medios de pago.
- Seguimiento por período, progreso e hitos.

### Deudas, pagos y contactos

- Separación entre tarjetas, compras en cuotas, préstamos y otras deudas.
- Deudas por pagar y por cobrar, fijas o variables, con pagos únicos o periódicos.
- Pago parcial, pago de una deuda y pago o cobro total por contacto.
- Contactos con nombre, apodo, parentesco, correo, teléfono y cuentas bancarias opcionales.
- Gastos divididos que generan cuentas por cobrar.
- Archivo de deudas fuera de la vista principal y pantalla independiente para restaurarlas.

### Recurrencias y notificaciones

- Gastos, ingresos y aportes de ahorro recurrentes.
- Frecuencias semanal, mensual, anual y personalizada, con próxima ejecución editable.
- Registro automático o con confirmación.
- Push locales con permiso solicitado cuando corresponde.
- Recordatorio configurable de movimientos.
- Bandeja con leídas/no leídas, agrupación por día, detalle, eliminación y acciones profundas.
- Prevención de notificaciones recurrentes duplicadas.

### Reportes, respaldo y configuración

- Histórico por períodos, gráficos y exportación de reporte PDF.
- Respaldo y restauración opcional en `appDataFolder` de Google Drive.
- Validación de identidad, versión, integridad y relaciones antes de reemplazar la base local.
- Diagnósticos locales traducidos a mensajes comprensibles y correo de soporte con contexto técnico.
- Tema claro, oscuro o del sistema; español e inglés; protección biométrica; privacidad y borrado local.
- Updates OTA con identificación de versión activa y aviso de actualización vigente.

## Estado técnico comprobado

- 45 pantallas/rutas TSX y 27 tablas SQLite.
- Esquema v27 con registro determinista de migraciones.
- 144 pruebas funcionales y 4 pruebas específicas de migración aprobadas.
- Lint, TypeScript y contrato de esquema aprobados al momento de este informe.
- Matriz de regresión que asigna todas las rutas a recorridos y exige artefactos automatizados.
- E2E Maestro para onboarding, flujo financiero, configuración/localización y frontera de Google Drive.
- CI en GitHub Actions y builds EAS separados para desarrollo, preview, pruebas y producción.
- Runtime OTA ligado a la versión de la app y proceso documentado de despliegue gradual.

### Hallazgo de dependencias

`npm audit --omit=dev` reportó 23 vulnerabilidades transitivas: 19 moderadas y 4 altas. Varias provienen de la cadena Expo/Metro o herramientas que no procesan directamente datos financieros en tiempo de ejecución, pero deben revisarse antes de producción. **No se debe ejecutar `npm audit fix --force` automáticamente**, porque propone saltos incompatibles —incluido Expo 57—. La corrección debe hacerse siguiendo las versiones compatibles de Expo SDK 54 o mediante una migración planificada de SDK.

## Riesgos y mejoras recomendadas

### Prioridad 0: antes de una publicación pública

1. **Prueba real de actualización.** Instalar una versión anterior con datos representativos, actualizar al binario candidato y comprobar migraciones, saldos, recurrencias, notificaciones y restauración. La instalación limpia no reemplaza esta prueba.
2. **Matriz de datos de regresión.** Mantener respaldos ficticios y anonimizados por versiones relevantes del esquema para ensayar cada salto soportado.
3. **Revisión de dependencias.** Clasificar las 23 alertas por alcance real, actualizar parches compatibles y documentar excepciones temporales con fecha de revisión.
4. **Crash y ANR monitoring.** Incorporar una solución con consentimiento y sin adjuntar montos, nombres ni respaldos. Hoy los diagnósticos locales ayudan, pero no permiten conocer la frecuencia real de fallos en producción.
5. **Pruebas de notificaciones en dispositivo.** Cubrir reinicio, cambio de zona horaria, horario de verano, permiso denegado, actualización de la app y ejecución atrasada.
6. **Seguridad del respaldo.** Decidir entre cifrado antes de subir a Drive o una comunicación explícita y visible de que el archivo depende de la seguridad de la cuenta Google.
7. **Checklist de tienda.** Política pública HTTPS, Data Safety, permisos del AAB final, capturas, soporte, eliminación de datos, notas de versión y pruebas internas.

### Prioridad 1: profesionalización del producto

1. **Modularizar la capa de datos.** `lib/db.ts` supera 8.000 líneas y `DatabaseContext` 1.200. Separar por dominios reales —movimientos, cuentas, tarjetas, ahorro, deudas, recurrencias, notificaciones— manteniendo transacciones centrales y pruebas de integración.
2. **Evitar refrescos globales.** Varias escrituras vuelven a cargar gran parte del estado. Implementar invalidación por dominio o consultas observables mejorará velocidad y consumo cuando crezca el historial.
3. **Auditoría financiera y deshacer.** Añadir un registro legible de cambios críticos y una papelera/undo temporal para eliminaciones. En finanzas, saber qué cambió y recuperarlo genera confianza.
4. **Cifrado local.** Evaluar cifrado de la base o protección de campos sensibles. La biometría protege la interfaz, pero no equivale a cifrar el archivo SQLite.
5. **Accesibilidad completa.** Auditar TalkBack/VoiceOver, orden de foco, tamaño de texto grande, contraste, objetivos táctiles y formularios con teclado visible.
6. **Pruebas E2E más profundas.** Agregar migración desde versión anterior, pagos parciales, deuda por contacto, conciliación, compra en cuotas, restauración autenticada y actualización OTA.
7. **Cobertura iOS.** El proyecto declara iOS, pero la puerta automatizada principal está centrada en Android 15. Incorporar simulador iOS y una ronda periódica en dispositivo real.
8. **Centro de avisos descartados.** Si los usuarios descartan avisos por error, ofrecer una vista de descartados o una acción breve “Deshacer”.

### Prioridad 2: evolución funcional

1. **Respaldo automático versionado**, con retención de varias copias y restauración previa a una actualización importante.
2. **Exportación CSV/Excel** además del PDF, con selección de período y campos.
3. **Presupuestos y proyección de flujo**, aprovechando recurrencias, cuotas, deudas y fechas de vencimiento ya registradas.
4. **Búsqueda global**, capaz de encontrar movimientos, contactos, deudas, cuentas y metas desde un solo lugar.
5. **Sincronización bancaria opcional y de solo lectura**, únicamente con un proveedor regulado y después de resolver privacidad, consentimiento y soporte.
6. **Monedas múltiples**, solo si se define primero cómo se convertirán saldos históricos y reportes; hoy el producto está coherentemente centrado en CLP.

## Qué no agregaría todavía

- No incorporaría inversión, criptomonedas, crédito automático ni recomendaciones financieras personalizadas antes de estabilizar la operación principal.
- No construiría sincronización multiusuario propia antes de contar con autenticación, cifrado, resolución de conflictos y soporte.
- No seguiría ampliando formularios sin antes medir dónde abandonan o se equivocan los usuarios de prueba.
- No actualizaría Expo o dependencias mayores únicamente para “limpiar” el audit sin una rama y plan de migración específicos.

## Hoja de ruta sugerida

### Etapa 1 — Release candidate

- Resolver o aceptar formalmente las alertas de dependencias.
- Ejecutar pruebas de actualización y restauración con datos representativos.
- Completar QA Android real, accesibilidad esencial y checklist Play Store.
- Publicar en canal interno y observar fallos durante al menos una semana.

### Etapa 2 — Lanzamiento controlado

- Incorporar crash/ANR monitoring respetuoso de privacidad.
- Desplegar gradualmente 5%, 20%, 50% y 100%.
- Corregir primero pérdida de datos, cálculos incorrectos, bloqueos y duplicados; después, detalles visuales.

### Etapa 3 — Escala y mantenibilidad

- Modularizar base de datos y contexto.
- Mejorar actualización incremental del estado.
- Agregar historial de cambios, recuperación y respaldos versionados.
- Ampliar E2E a iOS y actualizaciones reales.

## Conclusión

FinniApp tiene una propuesta coherente y un alcance funcional sorprendentemente completo. Su mayor fortaleza es que el modelo financiero ya considera situaciones que suelen romper aplicaciones de este tipo: movimientos en el mismo día, saldos informados, cuotas, conciliaciones, pagos de tarjeta, recurrencias y migraciones.

El siguiente salto de calidad no depende de agregar más pantallas. Depende de demostrar que los datos sobreviven actualizaciones y restauraciones, reducir el riesgo técnico de módulos muy grandes, observar fallos reales sin invadir la privacidad y formalizar seguridad y releases. Con esas mejoras, FinniApp puede pasar de una beta avanzada a un producto publicable y mantenible con confianza.
