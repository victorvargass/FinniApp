# Hoja de ruta de profesionalización

Orden de ejecución: de menor a mayor esfuerzo y riesgo. Los cambios se
confirman localmente por etapa y se publican juntos únicamente al terminar el
bloque acordado.

## 1. Controles pequeños

- [x] Acción temporal **Deshacer** al descartar un aviso de Inicio.
- [x] Aviso visible sobre la protección real del respaldo de Google Drive.
- [x] Actualizaciones transitivas compatibles y política automatizada para
  alertas críticas/altas de dependencias.
- [x] Checklist verificable de publicación y Data Safety.
- [x] Matriz versionada de datos ficticios v24/v27 para migraciones.
- [x] Matriz manual de notificaciones en dispositivo real (pendiente ejecutar
  contra cada candidata).

## 2. Calidad de producto

- [x] Auditoría de accesibilidad esencial y contrato para componentes
  compartidos. La matriz TalkBack/VoiceOver se ejecuta por candidata.
- [x] E2E de pagos parciales, deudas por contacto, conciliación y compras en
  cuotas, con datos y saldos verificados en la interfaz.
- [x] Prueba Android automatizada de actualización real desde una base v27
  poblada, instalada dentro del sandbox antes de abrir el binario candidato.
- [x] Exportación CSV con período y campos seleccionables.
- [x] Búsqueda global de movimientos de todos los períodos, contactos, deudas,
  compras en cuotas, medios de pago y metas, con navegación al detalle.
- [x] Cobertura automatizada en simulador iOS y matriz de ronda periódica en
  dispositivo real (la ejecución se registra por candidata).

## 3. Recuperación, operación y privacidad

- [x] Auditoría financiera de eliminaciones de gastos e ingresos y recuperación
  durante 30 días para movimientos ordinarios. Los movimientos con relaciones
  financieras quedan auditados, pero se protegen de una restauración parcial.
- [x] Respaldos automáticos diarios cuando Google Drive ya está conectado,
  cinco versiones remotas con retención y tres copias locales previas a
  migraciones de esquema.
- [ ] Monitoreo de crashes/ANR con consentimiento, sin nombres, montos, notas o
  respaldos.
- [ ] Cifrado del respaldo antes de subirlo a Drive.
- [ ] Evaluación y migración segura hacia cifrado local.

## 4. Arquitectura y escala

- [ ] Invalidación y recarga por dominio para evitar refrescos globales.
- [ ] Separación de `lib/db.ts` por movimientos, cuentas, tarjetas, ahorro,
  deudas, recurrencias y notificaciones.
- [ ] División de `DatabaseContext` en contextos/consultas por dominio.
- [ ] Presupuestos y proyección de flujo con recurrencias y vencimientos.

## Decisiones de producto posteriores

La sincronización bancaria y las monedas múltiples no se implementarán como
un cambio incidental: requieren respectivamente un proveedor regulado y una
política de conversión histórica. Se abordarán después de completar seguridad,
recuperación y mantenibilidad.
