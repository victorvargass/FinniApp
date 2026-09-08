# Proceso de releases

## Canales y perfiles

- `development`: development client para trabajo local.
- `preview`: APK interno conectado al canal de updates `preview`.
- `production`: Android App Bundle para Play Store, canal `production` y `versionCode` autoincremental administrado por EAS.

El `runtimeVersion` sigue la versión de la app. Cualquier cambio nativo exige incrementar `expo.version` y generar un build nuevo; no debe publicarse como update OTA para un runtime anterior.

## Requisitos antes de integrar

1. Árbol Git limpio y rama actualizada.
2. `npm ci` y `npm run check` exitosos.
3. Export Android exitoso.
4. Migraciones y restauración verificadas con datos ficticios.
5. `CHANGELOG.md`, versión y política de privacidad actualizados.
6. Audit de dependencias revisado sin aplicar saltos mayores automáticos.

GitHub Actions ejecuta estos controles en cada pull request y push a `master`. El workflow manual de build requiere el secreto `EXPO_TOKEN` y ambientes protegidos llamados `preview` y `production`.

## QA y publicación

1. Generar un build `preview` y completar los recorridos críticos en al menos un Android real.
2. Subir la versión candidata al canal de pruebas internas de Play Console.
3. Validar inicio limpio, actualización desde la versión anterior, notificaciones, biometría, respaldo/restauración y PDF.
4. Generar `production` desde el commit aprobado y etiquetarlo como `vX.Y.Z`.
5. Iniciar el despliegue gradual en Play Console: 5%, 20%, 50% y 100%, dejando una ventana de observación entre etapas.

## Updates y rollback

- Publicar OTA solamente para cambios JavaScript compatibles con el mismo runtime y probar primero en `preview`.
- Ante una regresión OTA, detener el rollout y republicar o revertir al update estable anterior del canal.
- Ante una regresión nativa, detener el despliegue de Play y preparar un nuevo App Bundle con `versionCode` superior; Play Store no permite reutilizar el artefacto anterior como una versión nueva.
- Conservar el commit, etiqueta, build de EAS y notas correspondientes a cada release.

## Checklist de Play Store

- Política de privacidad pública en HTTPS y formulario Data Safety revisado.
- Ficha, capturas, ícono, clasificación de contenido y audiencia completados.
- Acceso de prueba y credenciales de Google aisladas de datos personales.
- Declaración y justificación de permisos del App Bundle final.
- Contacto de soporte y procedimiento de eliminación de datos visibles.
