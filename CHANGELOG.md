# Changelog

Los cambios relevantes de FinniApp se documentan aquí siguiendo Keep a Changelog y versionado semántico.

## [Sin publicar]

## [1.2.0] - 2026-10-01

### Añadido

- Frecuencia de respaldo configurable: diaria, semanal, mensual o solo manual.
- Progreso visible por etapas y medición del tiempo de respaldo y restauración.

### Mejorado

- Cifrado de respaldos acelerado de forma nativa, conservando compatibilidad con respaldos anteriores.
- Los respaldos automáticos omiten el cifrado y la subida cuando los datos no cambiaron.
- Mejor presentación del monto proyectado y del crédito facturado pendiente.

### Corregido

- Las OTA del canal preview usan explícitamente las variables del entorno preview, incluido Sentry.

## [1.1.0] - 2026-10-01

### Añadido

- Onboarding de primera ejecución y guía reutilizable.
- Reportes PDF con ahorros, deudas, cuotas, ciclos y recurrencias.
- Pruebas automatizadas para cálculos y protecciones SQLite.
- Pantalla y documentación de privacidad.

### Seguridad

- Serialización de operaciones SQLite y cierre de período transaccional.
- Validación reforzada y rollback de restauraciones.
- Redacción de diagnósticos y reducción de superficie OAuth.

## [1.0.0] - Pendiente

- Primera versión candidata para pruebas internas.
