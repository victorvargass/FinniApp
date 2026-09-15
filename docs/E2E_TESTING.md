# Pruebas E2E

FinniApp usa Maestro sobre una compilación nativa de Expo SDK 54. Los flujos no usan Expo Go: instalan y ejercitan el APK real, SQLite, Expo Router y los formularios de la aplicación.

Las instrucciones reproducibles de instalación, compilación, conexión del teléfono o emulador, configuración de Maestro y solución de problemas están en [WINDOWS_RUNBOOK.md](WINDOWS_RUNBOOK.md).

## Cobertura automatizada

- recorrido completo del onboarding, incluida la confirmación del primer período;
- creación, edición y eliminación de gastos e ingresos;
- cierre del período con movimientos reales;
- navegación por cuentas, tarjetas, transferencias, ahorros, deudas y recurrencias;
- cambio ES/EN sin abandonar Configuración y acceso a Privacidad;
- límite de autenticación y respaldo de Google Drive.

La fuente de verdad es `tests/regression-matrix.json`. Cada pantalla debe pertenecer a un recorrido y cada recorrido crítico debe apuntar a una prueba Maestro. `tests/regression-matrix.test.mjs` falla automáticamente si se agrega una pantalla sin clasificar, se elimina una prueba, un flujo queda fuera del workflow E2E o un build distribuible pierde su puerta Maestro.

El flujo de Google sin credenciales termina intencionalmente en `Conectar con Google`. La selección de cuenta, respaldo, restauración y cierre de sesión se deben ejecutar con una cuenta Google exclusiva de QA ya agregada al emulador. Nunca se guardan correo, contraseña, tokens ni códigos de recuperación en Maestro o Git.

Cuando esa cuenta ya esté conectada en FinniApp, el ciclo autenticado completo se ejecuta por separado:

```powershell
npm run e2e:google
```

Este recorrido crea o reemplaza el respaldo de la cuenta QA, lo restaura y finalmente cierra la sesión. No se debe ejecutar con una cuenta personal.

## Ejecución en EAS

```powershell
npm run e2e:eas:android
```

El job Maestro de EAS requiere un plan Expo pagado. En el plan gratuito se puede compilar/instalar el APK y ejecutar `npm run e2e:android` localmente sobre un emulador o dispositivo Android conectado.

El workflow `.eas/workflows/e2e-test-android.yml` crea un APK sin credenciales de tienda y ejecuta los cuatro flujos sin credenciales cuando se solicita manualmente. Este camino requiere un plan Expo pagado.

En el plan actual, `.github/workflows/e2e-android.yml` ofrece la puerta automática: compila el APK, inicia Android 15, ejecuta Maestro y conserva la evidencia. Se dispara en cada pull request y push a `master`. El workflow manual `.github/workflows/build.yml` espera su resultado antes de solicitar un preview o producción a EAS.

## Ejecución local

Requisitos:

1. Instalar Android Studio, crear/iniciar un AVD y verificarlo con `adb devices`.
2. Instalar Maestro CLI y comprobarlo con `maestro --version`.
3. Construir e instalar la app con `npx expo run:android`, o instalar un APK del perfil E2E.
4. Ejecutar `npm run e2e:android`.

En Windows se recomienda Maestro CLI 1.40.3 para este proyecto. La versión 2.10.0 presentó bloqueos de archivos de sesión durante la verificación del 8 de septiembre de 2026. El comando completo y la configuración de `JAVA_OPTS` están documentados en el manual de Windows.

Para validar Google Drive de extremo a extremo, agrega previamente al AVD una cuenta exclusiva de QA, ejecuta `.maestro/google-drive-boundary.yml`, pulsa `Conectar con Google` y continúa manualmente con respaldo, restauración y cierre de sesión. Usa datos desechables: restaurar reemplaza la base local del emulador.

## Diagnóstico

Maestro conserva capturas, jerarquía de accesibilidad y comandos fallidos. Los controles críticos tienen identificadores estables (`onboarding-*`, `tab-*`, `expense-*`, `income-*`, `period-close` y `settings-load-test-data`) para que cambios de estilo o traducciones no rompan los recorridos principales.
