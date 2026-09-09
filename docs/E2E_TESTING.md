# Pruebas E2E

FinniApp usa Maestro sobre una compilación nativa de Expo SDK 54. Los flujos no usan Expo Go: instalan y ejercitan el APK real, SQLite, Expo Router y los formularios de la aplicación.

## Cobertura automatizada

- primera apertura y omisión del onboarding;
- carga del escenario integral de prueba;
- creación, edición y eliminación de un gasto;
- creación y eliminación de un ingreso;
- disponibilidad del cierre con movimientos en el período;
- navegación hasta la pantalla independiente de Google Drive.

El flujo de Google termina intencionalmente en `Conectar con Google`. La selección de cuenta, respaldo, restauración y cierre de sesión se deben ejecutar con una cuenta Google exclusiva de QA ya agregada al emulador. Nunca se guardan correo, contraseña, tokens ni códigos de recuperación en Maestro o Git.

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

El workflow `.eas/workflows/e2e-test-android.yml` crea un APK sin credenciales de tienda usando el perfil `e2e-test` y luego ejecuta ambos flujos en un emulador administrado por EAS.

## Ejecución local

Requisitos:

1. Instalar Android Studio, crear/iniciar un AVD y verificarlo con `adb devices`.
2. Instalar Maestro CLI y comprobarlo con `maestro --version`.
3. Construir e instalar la app con `npx expo run:android`, o instalar un APK del perfil E2E.
4. Ejecutar `npm run e2e:android`.

Para validar Google Drive de extremo a extremo, agrega previamente al AVD una cuenta exclusiva de QA, ejecuta `.maestro/google-drive-boundary.yml`, pulsa `Conectar con Google` y continúa manualmente con respaldo, restauración y cierre de sesión. Usa datos desechables: restaurar reemplaza la base local del emulador.

## Diagnóstico

Maestro conserva capturas, jerarquía de accesibilidad y comandos fallidos. Los controles críticos tienen identificadores estables (`onboarding-*`, `tab-*`, `expense-*`, `income-*`, `period-close` y `settings-load-test-data`) para que cambios de estilo o traducciones no rompan los recorridos principales.
