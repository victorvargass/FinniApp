# Seguridad de FinniApp

## Reporte responsable

Para informar una vulnerabilidad, escribe a victorvargassandoval93@gmail.com. No incluyas respaldos reales, tokens, contraseñas ni información financiera en el mensaje inicial.

## Controles actuales

- SQLite en modo WAL, claves foráneas activas, espera ante bloqueos y serialización de operaciones compuestas.
- Restauración con validación de cabecera, integridad, claves foráneas, tablas mínimas, versión y aplicación de origen.
- Copia de rollback antes de reemplazar la base activa.
- Google Drive limitado a `drive.appdata`; no se usa acceso general al Drive.
- Tokens OAuth solo en memoria y sin escritura intencional en logs.
- Archivos de entorno, llaves y configuración nativa sensible excluidos de Git.

## Riesgos conocidos y trabajo pendiente

- El archivo SQLite local y el respaldo no tienen cifrado propio de extremo a extremo.
- La biometría protege la interfaz, no cifra los datos en reposo.
- `npm audit --omit=dev` informa vulnerabilidades transitivas asociadas principalmente a Expo/Metro y React Navigation. Las correcciones propuestas requieren saltar de Expo SDK 54 a versiones mayores incompatibles, por lo que deben resolverse mediante una actualización planificada y probada del SDK, no con `npm audit fix --force`.
- Los E2E de Google Drive requieren una cuenta de prueba aislada y no deben usar datos personales.

## Reglas de desarrollo

- Nunca registrar tokens, cuerpos de respuestas OAuth, rutas con datos personales ni contenido financiero.
- No incorporar client secrets, claves privadas ni archivos de servicio al repositorio.
- Ejecutar `npm run check` antes de integrar cambios.
- Validar respaldos con datos ficticios, versiones antiguas conocidas y archivos corruptos.
