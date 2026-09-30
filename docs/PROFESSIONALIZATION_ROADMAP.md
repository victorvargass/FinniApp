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
- [x] Monitoreo de crashes/ANR con consentimiento, sin nombres, montos, notas o
  respaldos. La activación del proyecto Sentry y la prueba en dispositivos
  reales se ejecutan por candidata con `docs/CRASH_MONITORING.md`.
- [x] Cifrado autenticado del respaldo antes de subirlo a Drive, con contraseña
  portable entre dispositivos, almacenamiento local en SecureStore y lectura
  compatible con respaldos SQLite anteriores. La matriz por candidata está en
  `docs/ENCRYPTED_BACKUPS.md`.
- [x] Cifrado local con SQLCipher, clave aleatoria en SecureStore, conversión
  transaccional de bases anteriores, copias de migración cifradas y pantalla
  recuperable ante fallos de apertura. La matriz está en
  `docs/LOCAL_DATABASE_ENCRYPTION.md`.

## 4. Arquitectura y escala

- [x] Recarga financiera por dominio para movimientos, saldos, tarjetas,
  ahorros y deudas; la inicialización, configuración y recurrencias conservan
  la sincronización global cuando realmente la necesitan.
- [x] Capa de persistencia expuesta por módulos de movimientos, medios de pago,
  ahorro, deudas, períodos, recurrencias, notificaciones, configuración,
  contactos y categorías. `lib/db.ts` queda como fachada de compatibilidad y
  el motor transaccional privado conserva las operaciones compuestas.
- [x] Contextos y consultas divididos por período, movimientos, medios de pago,
  ahorro, deudas, recurrencias, organización y preferencias. Todas las vistas
  consumen hooks de dominio con identidades estables independientes.
- [x] Presupuestos por categoría y proyección del flujo restante del período
  con recurrencias pendientes, cuotas de tarjeta y vencimientos de deudas, sin
  duplicar movimientos ya registrados.

## Decisiones de producto posteriores

La sincronización bancaria y las monedas múltiples no se implementarán como
un cambio incidental: requieren respectivamente un proveedor regulado y una
política de conversión histórica. Se abordarán después de completar seguridad,
recuperación y mantenibilidad.
