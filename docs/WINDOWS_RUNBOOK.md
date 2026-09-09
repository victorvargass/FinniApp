# Manual de desarrollo y pruebas en Windows

Esta guía registra el procedimiento reproducible utilizado con FinniApp. Los comandos están escritos para **PowerShell** y parten desde `C:\Users\Victor\FinniApp`, salvo cuando se indique otra ruta.

## Resultado verificado

El 8 de septiembre de 2026 se verificó lo siguiente:

- Expo SDK 54 y la aplicación compilaron correctamente;
- el APK debug se instaló en un Motorola Edge 50 Pro conectado por USB;
- Metro entregó el bundle al teléfono mediante `adb reverse`;
- lint, TypeScript y 11 pruebas automatizadas terminaron correctamente;
- el recorrido financiero completo de Maestro terminó correctamente;
- el recorrido de Google Drive llegó correctamente hasta `Conectar con Google`;
- Maestro CLI 1.40.3 fue la versión estable en este equipo;
- Maestro 2.10.0 presentó bloqueos de archivos de sesión en Windows;
- EAS rechazó el job Maestro porque la cuenta actual no tiene un plan pagado.

El AVD `Pixel_7_API_34` existe, pero el recorrido completo se verificó en el teléfono físico. La autenticación real de Google debe probarse con una cuenta exclusiva de QA.

## 1. Consola y ruta

Abrir **PowerShell** o PowerShell 7. Los comandos de esta guía no están escritos para Git Bash ni WSL.

```powershell
Set-Location C:\Users\Victor\FinniApp
```

Conviene usar dos consolas:

1. Consola A para mantener Metro ejecutándose.
2. Consola B para compilar, usar ADB y ejecutar Maestro.

## 2. Requisitos y comprobaciones

Este proyecto necesita Node.js, Java 17, Android SDK y las dependencias npm.

```powershell
node --version
npm --version
java -version
```

Expo SDK 54 requiere Node.js 20.19 o posterior. En este equipo Java 17 está instalado en `C:\Program Files\Java\jdk-17` y el Android SDK en `C:\Users\Victor\AppData\Local\Android\Sdk`.

Para no depender de que `adb` esté agregado globalmente a `PATH`:

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$androidSdk\platform-tools\adb.exe" devices -l
& "$androidSdk\emulator\emulator.exe" -list-avds
```

La lista debería mostrar un teléfono con estado `device` o un emulador. Si aparece `unauthorized`, desbloquear el teléfono y aceptar la autorización USB.

Instalar exactamente las versiones declaradas en `package-lock.json`:

```powershell
Set-Location C:\Users\Victor\FinniApp
npm ci
```

## 3. Validación rápida antes de trabajar

```powershell
Set-Location C:\Users\Victor\FinniApp
npm run check
```

Ese comando ejecuta ESLint, comprueba TypeScript sin generar archivos y corre las pruebas unitarias y de integración de Node.

También se puede comprobar que Expo genere el bundle Android:

```powershell
npm run export:android
```

## 4. Iniciar Metro

En la consola A:

```powershell
Set-Location C:\Users\Victor\FinniApp
npx expo start --dev-client --localhost
```

Dejar esa consola abierta. Si Expo avisa que el puerto 8081 ya está ocupado, primero comprobar si Metro ya está funcionando; no hace falta iniciar una segunda instancia.

## 5. Preparar un teléfono Android

En el teléfono, activar las opciones de desarrollador y la depuración USB. Conectarlo por USB y aceptar la huella del computador.

En la consola B:

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$androidSdk\platform-tools\adb.exe" devices -l
& "$androidSdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

`adb reverse` permite que el APK instalado encuentre Metro en el puerto 8081 del computador.

Si hay varios dispositivos, copiar el identificador entregado por `devices -l` y especificarlo:

```powershell
& "$androidSdk\platform-tools\adb.exe" -s ZY22JTBJHS reverse tcp:8081 tcp:8081
```

El identificador anterior corresponde al teléfono usado durante la verificación; puede cambiar en otro dispositivo.

## 6. Iniciar el emulador disponible

Para iniciar el AVD existente en este equipo:

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$androidSdk\emulator\emulator.exe" -avd Pixel_7_API_34
```

Esperar a que Android termine de iniciar y comprobarlo desde otra consola:

```powershell
& "$androidSdk\platform-tools\adb.exe" devices -l
```

Si se conectan simultáneamente el teléfono y el emulador, usar `-s <identificador>` en los comandos ADB para evitar ambigüedad.

## 7. Compilar e instalar el APK debug

Este es el comando exacto que terminó correctamente. Se ejecuta desde la carpeta `android`:

```powershell
Set-Location C:\Users\Victor\FinniApp\android
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\Victor\.gradle'
$env:NODE_ENV = 'development'
.\gradlew.bat app:installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 '-PreactNativeArchitectures=arm64-v8a'
```

`arm64-v8a` sirve para el teléfono y para la mayoría de los emuladores actuales. Si se necesita también arquitectura de 32 bits:

```powershell
.\gradlew.bat app:installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a'
```

Después de instalar, volver a aplicar `adb reverse` si el dispositivo no carga el bundle.

Como alternativa habitual de Expo se puede usar `npx expo run:android --device`, aunque el comando Gradle anterior es el que fue comprobado exactamente en este equipo.

## 8. Instalar la versión de Maestro que funcionó

Maestro CLI 1.40.3 completó el flujo financiero en Windows. Para dejarlo en una ruta permanente:

```powershell
$maestroVersion = '1.40.3'
$maestroRoot = "C:\Tools\maestro-$maestroVersion"
$maestroZip = Join-Path $env:TEMP "maestro-$maestroVersion.zip"
curl.exe -sS -L "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$maestroVersion/maestro.zip" -o $maestroZip
New-Item -ItemType Directory -Force -Path $maestroRoot | Out-Null
Expand-Archive -LiteralPath $maestroZip -DestinationPath $maestroRoot -Force
$maestro = (Get-ChildItem -LiteralPath $maestroRoot -Recurse -Filter maestro.bat | Select-Object -First 1).FullName
& $maestro --version
```

Para habilitar `maestro` y los scripts npm durante la consola actual:

```powershell
$maestro = (Get-ChildItem -LiteralPath 'C:\Tools\maestro-1.40.3' -Recurse -Filter maestro.bat | Select-Object -First 1).FullName
$env:Path = "$(Split-Path -Parent $maestro);$env:Path"
maestro --version
```

No es obligatorio modificar permanentemente el `PATH` de Windows.

## 9. Ejecutar los E2E locales

Antes de ejecutar, Metro debe estar activo, el APK instalado, `adb devices -l` debe mostrar el dispositivo y la pantalla debe permanecer desbloqueada. En un teléfono físico también debe estar aplicado `adb reverse`.

En la consola B:

```powershell
Set-Location C:\Users\Victor\FinniApp
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
$maestro = (Get-ChildItem -LiteralPath 'C:\Tools\maestro-1.40.3' -Recurse -Filter maestro.bat | Select-Object -First 1).FullName
$env:Path = "$(Split-Path -Parent $maestro);$env:Path"
$maestroHome = Join-Path $env:TEMP 'finniapp-maestro-session'
New-Item -ItemType Directory -Force -Path (Join-Path $maestroHome '.maestro') | Out-Null
$env:JAVA_OPTS = "-Duser.home=$maestroHome"
npm run e2e:android
```

El script ejecuta `.maestro/smoke-financial.yml` y `.maestro/google-drive-boundary.yml`.

También se puede ejecutar un flujo directamente y guardar diagnóstico:

```powershell
& $maestro test --no-ansi --debug-output .maestro-results\financial .maestro\smoke-financial.yml
```

Los resultados y capturas de diagnóstico quedan bajo `.maestro-results`, carpeta ignorada por Git.

## 10. Qué valida el recorrido financiero

El flujo `.maestro/smoke-financial.yml` recorre la aplicación real y valida:

- onboarding;
- carga de datos ficticios;
- deudas y ahorros;
- recurrencias y medios de pago;
- creación, edición y eliminación de un gasto;
- creación y eliminación de un ingreso;
- disponibilidad del cierre de período cuando hay movimientos.

El flujo `.maestro/google-drive-boundary.yml` comprueba la navegación hasta la pantalla independiente de Google Drive y se detiene en `Conectar con Google`.

## 11. Prueba autenticada de Google Drive

Esta prueba requiere una cuenta Google exclusiva de QA, previamente agregada al teléfono o emulador. No se deben almacenar correo, contraseña, tokens ni códigos de recuperación en el repositorio.

Primero ejecutar el flujo de frontera, pulsar `Conectar con Google` y completar manualmente la selección de la cuenta QA. Una vez que FinniApp muestre la cuenta conectada:

```powershell
Set-Location C:\Users\Victor\FinniApp
npm run e2e:google
```

Advertencia: `.maestro/google-drive-authenticated.yml` crea o reemplaza el respaldo, restaura la base local y finalmente cierra la sesión. No ejecutarlo con una cuenta personal ni con datos que deban conservarse.

## 12. E2E remoto con EAS

El workflow está en `.eas/workflows/e2e-test-android.yml`.

```powershell
Set-Location C:\Users\Victor\FinniApp
eas whoami
eas workflow:validate .eas/workflows/e2e-test-android.yml
npm run e2e:eas:android
```

En la verificación, `eas whoami` devolvió `vitoco18`. EAS aceptó la configuración pero rechazó el job `maestro_test` porque ese tipo de ejecución requiere un plan pagado. Mientras la cuenta siga en el plan gratuito, usar los E2E locales; no es un error de los archivos YAML.

## 13. Flujo Git seguro

Antes de crear un commit:

```powershell
Set-Location C:\Users\Victor\FinniApp
git status --short
git diff --check
git diff
```

Agregar solamente los archivos relacionados con el cambio:

```powershell
git add -- ruta\archivo1 ruta\archivo2
git diff --cached
git diff --cached --check
git commit -m "TIPO: descripción concisa"
git push origin master
```

No usar `git add .` cuando haya cambios ajenos o trabajo sin terminar. Los mensajes recientes usan prefijos como `FIX`, `TEST`, `REFACTOR`, `DOCS` y `CHORE`.

## 14. Problemas frecuentes

### `adb` no se reconoce

Usar su ruta completa:

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$androidSdk\platform-tools\adb.exe" devices -l
```

### El dispositivo aparece como `unauthorized`

Desbloquear el teléfono, desconectar y volver a conectar el cable, y aceptar el diálogo de depuración USB.

### La app queda esperando el bundle

Confirmar que Metro está activo y ejecutar:

```powershell
& "$androidSdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

### Gradle dice que no encuentra el proyecto

El comando `gradlew.bat` debe ejecutarse desde:

```powershell
Set-Location C:\Users\Victor\FinniApp\android
```

### Aviso de `NODE_ENV`

Definirlo antes de compilar:

```powershell
$env:NODE_ENV = 'development'
```

### Maestro intenta escribir en `C:\.maestro`

Dar a Java un directorio de usuario temporal y crear la carpeta esperada:

```powershell
$maestroHome = Join-Path $env:TEMP 'finniapp-maestro-session'
New-Item -ItemType Directory -Force -Path (Join-Path $maestroHome '.maestro') | Out-Null
$env:JAVA_OPTS = "-Duser.home=$maestroHome"
```

### Maestro informa archivos de sesión bloqueados

En este equipo ocurrió con Maestro 2.10.0. Usar 1.40.3 y un `$maestroHome` distinto para cada ejecución si quedó un proceso anterior:

```powershell
$maestroHome = Join-Path $env:TEMP "finniapp-maestro-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path (Join-Path $maestroHome '.maestro') | Out-Null
$env:JAVA_OPTS = "-Duser.home=$maestroHome"
```

### EAS dice que `maestro_test` requiere un plan pagado

Es una restricción del plan de Expo. Ejecutar `npm run e2e:android` localmente hasta contratar un plan compatible.

## 15. Secuencia corta para repetir la prueba

Con dependencias, Android SDK y Maestro ya instalados:

```powershell
# Consola A
Set-Location C:\Users\Victor\FinniApp
npx expo start --dev-client --localhost
```

```powershell
# Consola B
Set-Location C:\Users\Victor\FinniApp
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
& "$androidSdk\platform-tools\adb.exe" devices -l
& "$androidSdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
npm run check
$maestro = (Get-ChildItem -LiteralPath 'C:\Tools\maestro-1.40.3' -Recurse -Filter maestro.bat | Select-Object -First 1).FullName
$env:Path = "$(Split-Path -Parent $maestro);$androidSdk\platform-tools;$env:Path"
$maestroHome = Join-Path $env:TEMP 'finniapp-maestro-session'
New-Item -ItemType Directory -Force -Path (Join-Path $maestroHome '.maestro') | Out-Null
$env:JAVA_OPTS = "-Duser.home=$maestroHome"
npm run e2e:android
```

Si el APK todavía no está instalado, ejecutar primero la sección 7.

## Referencias oficiales

- [Documentación versionada de Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
- [Pruebas E2E con Maestro en EAS Workflows](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
