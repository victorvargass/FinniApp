# Monitoreo de crashes y bloqueos

FinniApp integra Sentry únicamente para fallos técnicos. La función está
desactivada por defecto y se inicia después de que la persona acepta de forma
explícita en **Configuración → Preferencias → Ayudar a detectar fallos**.

## Datos permitidos

- Tipo de excepción y stack trace sin variables locales.
- Versión y build de la aplicación.
- Sistema operativo, arquitectura y modelo general del dispositivo.
- Contexto técnico fijo del subsistema que falló.
- Crash nativo, error JavaScript y detección de bloqueo admitida por el SDK.

Antes del envío se eliminan mensajes de error, usuario, petición, breadcrumbs,
extras, rutas de navegación, variables de stack y contextos personalizados. No
se habilitan capturas, jerarquía visual, replay, trazas de rendimiento ni
captura de peticiones fallidas.

## Configuración de EAS

El DSN identifica el proyecto receptor y se incluye en el binario; no es un
secreto. Debe configurarse por ambiente:

```powershell
eas env:create --environment preview --name EXPO_PUBLIC_SENTRY_DSN --value "https://PUBLIC_KEY@HOST/PROJECT_ID" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "https://PUBLIC_KEY@HOST/PROJECT_ID" --visibility plaintext
```

Para simbolicar los reportes, configura además `SENTRY_ORG` y
`SENTRY_PROJECT` como texto visible para el build, y `SENTRY_AUTH_TOKEN` con
visibilidad `secret`. El token nunca se agrega a `.env`, Git ni al binario.

## Verificación de una candidata

1. Generar un build release con el DSN y las credenciales de source maps.
2. Confirmar que el switch parte apagado en una instalación nueva.
3. Provocar un error ficticio sin datos reales antes de aceptar y verificar que
   no llega a Sentry.
4. Aceptar, provocar el error de prueba y verificar stack simbolicado, versión y
   dispositivo.
5. Inspeccionar el evento y confirmar que no contiene mensajes, nombres,
   montos, notas, movimientos, cuentas, capturas, replay ni variables locales.
6. Desactivar el switch, repetir el error y confirmar que no se recibe.
7. Validar crash nativo y bloqueo en Android/iOS reales; estos casos no quedan
   cubiertos por Expo Go ni por una exportación JavaScript.

La prueba debe usar exclusivamente datos ficticios y registrarse junto a la
checklist de la candidata.
