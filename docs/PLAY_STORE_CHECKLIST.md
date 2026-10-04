# Checklist de publicación en Google Play

Usar este documento contra el **App Bundle final**, no contra una compilación
de desarrollo. Marcar un punto solo cuando exista evidencia guardada junto a
la release.

## Identidad y ficha

- [ ] Versión y `versionCode` corresponden a las notas de la release.
- [ ] Nombre, descripción corta/larga, ícono, capturas y gráfico destacado son
  actuales y no prometen sincronización bancaria.
- [ ] Correo de soporte y URL HTTPS pública de privacidad responden.
- [ ] Clasificación de contenido, audiencia y disponibilidad territorial están
  revisadas.

## Privacidad y datos

- [ ] `PRIVACY.md` está publicado por HTTPS y enlazado desde la ficha y la app.
- [ ] El formulario Data Safety coincide con `docs/DATA_SAFETY.md` y con los
  SDK incluidos en el AAB.
- [ ] Se declara Google Sign-In/Drive solo cuando la persona activa el respaldo.
- [ ] Se explica cómo borrar datos locales y el respaldo privado de Drive.
- [ ] No se incorporó analítica, publicidad o crash reporting después de la
  última revisión sin actualizar política y Data Safety.

## Artefacto y permisos

- [ ] Revisar el manifiesto fusionado del AAB final.
- [ ] Justificar `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` y
  `SCHEDULE_EXACT_ALARM` con el comportamiento real.
- [ ] Confirmar que no existen permisos de contactos, SMS, ubicación, cámara o
  almacenamiento que FinniApp no utilice.
- [ ] `npx expo install --check`, `npm run check` y
  `npm run audit:security` terminan correctamente.

## Prueba de candidata

- [ ] Instalación limpia y onboarding en Android real.
- [ ] Actualización desde la versión pública anterior conservando datos.
- [ ] Cambio de esquema probado con datos ficticios representativos.
- [ ] Actualización desde una base local sin cifrar, segundo arranque y pérdida
  controlada de clave probados según `docs/LOCAL_DATABASE_ENCRYPTION.md`.
- [ ] Notificaciones probadas con permiso aceptado/denegado, reinicio, cambio
  horario y ejecución atrasada.
- [ ] Biometría, PDF, respaldo y restauración probados.
- [ ] Respaldo SQLite actual y compatibilidad con respaldos históricos cifrados
  probados según `docs/ENCRYPTED_BACKUPS.md`.
- [ ] Monitoreo técnico probado apagado/encendido/apagado con datos ficticios y
  evento inspeccionado en Sentry según `docs/CRASH_MONITORING.md`.
- [ ] Tema claro/oscuro, español/inglés y tamaño de fuente grande revisados.
- [ ] Cuenta Google exclusiva de QA; ningún dato personal en evidencias.

## Lanzamiento y respuesta

- [ ] Publicar primero en pruebas internas y registrar commit, build y tester.
- [ ] Observar la candidata al menos una semana antes de producción pública.
- [ ] Desplegar 5%, 20%, 50% y 100% con ventana de observación.
- [ ] Definir responsable y criterio de detención para pérdida de datos,
  cálculos erróneos, bloqueos o duplicados.
- [ ] Conservar artefacto, etiqueta, notas, resultados de QA y plan de rollback.
