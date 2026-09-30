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

- [x] Recarga financiera por dominio para movimientos, saldos, tarjetas,
  ahorros y deudas; la inicialización, configuración y recurrencias conservan
  la sincronización global cuando realmente la necesitan.
- [ ] Separación de `lib/db.ts` por movimientos, cuentas, tarjetas, ahorro,
  deudas, recurrencias y notificaciones.
  - Avance: conexión/transacciones, configuración, notificaciones, contactos y
    proyección ya viven en módulos reales; continúan pendientes los dominios
    financieros acoplados.
- [ ] División de `DatabaseContext` en contextos/consultas por dominio.
  - Avance: estado y acciones tienen identidades de contexto independientes y
    las primeras pantallas de solo lectura/acción ya usan los hooks livianos.
    Falta dividir el estado financiero por dominio y migrar el resto de vistas.
- [x] Presupuestos por categoría y proyección del flujo restante del período
  con recurrencias pendientes, cuotas de tarjeta y vencimientos de deudas, sin
  duplicar movimientos ya registrados.

## Decisiones de producto posteriores

La sincronización bancaria y las monedas múltiples no se implementarán como
un cambio incidental: requieren respectivamente un proveedor regulado y una
política de conversión histórica. Se abordarán después de completar seguridad,
recuperación y mantenibilidad.
