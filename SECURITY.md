# Seguridad de FinniApp

## Reporte responsable

Para informar una vulnerabilidad, escribe a victorvargassandoval93@gmail.com. No incluyas respaldos reales, tokens, contraseñas ni información financiera en el mensaje inicial.

## Controles actuales

- SQLite en modo WAL, claves foráneas activas, espera ante bloqueos y serialización de operaciones compuestas.
- Restauración con validación de cabecera, integridad, claves foráneas, tablas mínimas, versión y aplicación de origen.
- Copia de rollback antes de reemplazar la base activa.
- Google Drive limitado a `drive.appdata`; no se usa acceso general al Drive.
- Respaldos nuevos cifrados y autenticados antes de la subida con
  XChaCha20-Poly1305 y clave derivada de contraseña; compatibilidad de lectura
  para respaldos SQLite anteriores.
- Tokens OAuth solo en memoria y sin escritura intencional en logs.
- Monitoreo de fallos desactivado por defecto y sujeto a consentimiento. Antes
  del envío elimina mensajes, usuario, peticiones, breadcrumbs, extras,
  variables locales, capturas y replay de sesión.
- Archivos de entorno, llaves y configuración nativa sensible excluidos de Git.

## Riesgos conocidos y trabajo pendiente

- El archivo SQLite local todavía no tiene cifrado propio en reposo. Los
  respaldos nuevos sí se cifran, pero la pérdida de su contraseña impide
  recuperarlos en otro dispositivo.
- La biometría protege la interfaz, no cifra los datos en reposo.
- `npm audit --omit=dev` informa vulnerabilidades transitivas asociadas principalmente a Expo/Metro y React Navigation. Las correcciones propuestas requieren saltar de Expo SDK 54 a versiones mayores incompatibles, por lo que deben resolverse mediante una actualización planificada y probada del SDK, no con `npm audit fix --force`.
- Los E2E de Google Drive requieren una cuenta de prueba aislada y no deben usar datos personales.

## Reglas de desarrollo

- Nunca registrar tokens, cuerpos de respuestas OAuth, rutas con datos personales ni contenido financiero.
- No incorporar client secrets, claves privadas ni archivos de servicio al repositorio.
- Ejecutar `npm run check` antes de integrar cambios.
- Validar respaldos con datos ficticios, versiones antiguas conocidas y archivos corruptos.
