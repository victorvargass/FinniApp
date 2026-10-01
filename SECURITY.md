# Seguridad de FinniApp

## Reporte responsable

Para informar una vulnerabilidad, escribe a victorvargassandoval93@gmail.com. No incluyas respaldos reales, tokens, contraseñas ni información financiera en el mensaje inicial.

## Controles actuales

- SQLite cifrado con SQLCipher, journal `DELETE`, claves foráneas activas,
  espera ante bloqueos y serialización de operaciones compuestas. La clave
  aleatoria de 256 bits se conserva mediante el almacén seguro del sistema.
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

- La pérdida de la clave local impide abrir la base del dispositivo. La ruta de
  recuperación es un respaldo cifrado de Google Drive y su contraseña.
- La biometría protege la interfaz; el cifrado local protege el archivo en
  reposo. Son controles distintos y complementarios.
- `npm audit --omit=dev` aún puede informar vulnerabilidades moderadas
  transitivas asociadas principalmente a Expo/Metro y React Navigation. Las
  alertas altas conocidas de `image-size` y `postcss` se fijan mediante
  overrides compatibles y se verifican en CI. Los saltos mayores de Expo se
  realizan únicamente mediante una migración planificada y probada; nunca con
  `npm audit fix --force`.
- Los E2E de Google Drive requieren una cuenta de prueba aislada y no deben usar datos personales.

## Reglas de desarrollo

- Nunca registrar tokens, cuerpos de respuestas OAuth, rutas con datos personales ni contenido financiero.
- No incorporar client secrets, claves privadas ni archivos de servicio al repositorio.
- Ejecutar `npm run check` antes de integrar cambios.
- Validar respaldos con datos ficticios, versiones antiguas conocidas y archivos corruptos.
