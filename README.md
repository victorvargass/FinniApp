# FinniApp

Aplicación móvil de finanzas personales construida con Expo SDK 54 y React Native.

## Desarrollo local

El entorno utilizado y verificado para este proyecto es Windows con PowerShell, Android SDK y Java 17.

```powershell
Set-Location C:\Users\Victor\FinniApp
npm ci
npm run check
npx expo start --dev-client --localhost
```

La compilación nativa, instalación en Android, pruebas Maestro, respaldo Google Drive y solución de problemas están documentados paso a paso en [docs/WINDOWS_RUNBOOK.md](docs/WINDOWS_RUNBOOK.md).

## Documentación

- [Manual reproducible de Windows](docs/WINDOWS_RUNBOOK.md)
- [Pruebas E2E](docs/E2E_TESTING.md)
- [Proceso de releases](docs/RELEASE_PROCESS.md)
- [Seguridad y tratamiento de datos](docs/DATA_SAFETY.md)

## Comandos habituales

```powershell
npm run check
npm run export:android
npm run e2e:android
npm run e2e:google
npm run e2e:eas:android
```

`e2e:google` reemplaza y restaura un respaldo y luego cierra la sesión. Debe utilizarse únicamente con una cuenta Google exclusiva de QA y datos desechables.

## Publicar cambios con EAS Update (OTA)

FinniApp usa dos canales definidos en `eas.json`:

| Canal | Instalación que lo recibe |
| --- | --- |
| `preview` | APK interno generado con el perfil `preview` |
| `production` | Aplicación generada con el perfil `production` y distribuida por la tienda |

El canal queda incorporado en el binario al compilarlo. Una instalación `preview` no recibe las OTA de `production`, ni viceversa. En este proyecto, cuando se solicita **push y OTA**, se publica el mismo commit en ambos canales.

### 1. Preparar y validar los cambios

Cada cambio terminado debe tener su propio commit. Antes de publicar, el árbol debe estar limpio y todas las comprobaciones deben pasar:

```powershell
Set-Location C:\Users\Victor\FinniApp
npm run check
git status --short --branch
git log --oneline origin/master..HEAD
```

Si todavía hay archivos sin guardar en Git, crear el commit correspondiente antes de continuar. No publicar una OTA desde un árbol con cambios sin commit.

### 2. Confirmar la sesión de Expo y hacer push

```powershell
npx eas-cli whoami
git push origin master
```

Si `whoami` indica que no hay una sesión activa, iniciar sesión con:

```powershell
npx eas-cli login
```

### 3. Publicar la OTA en ambos canales

Usar el mismo mensaje y el mismo commit en `preview` y `production`:

```powershell
$otaMessage = "UI: descripción breve de los cambios"

npx eas-cli update --channel preview --message $otaMessage --non-interactive
npx eas-cli update --channel production --message $otaMessage --non-interactive
```

Cada comando debe finalizar con `Published!` y mostrar:

- el canal correcto;
- `Runtime version 1.3.0` mientras la versión de la app siga siendo `1.3.0`;
- Android e iOS como plataformas;
- el mismo hash de commit en ambas publicaciones;
- un enlace `EAS Dashboard` para revisar la actualización.

### 4. Verificar lo publicado

```powershell
npx eas-cli channel:view preview --non-interactive
npx eas-cli channel:view production --non-interactive
npx eas-cli update:list --branch preview --limit 5 --non-interactive
npx eas-cli update:list --branch production --limit 5 --non-interactive
git status --short --branch
```

Al terminar, Git debe mostrar `master...origin/master` sin archivos modificados ni commits pendientes.

### 5. Recibir la OTA en el teléfono

1. Abrir la aplicación con conexión a internet.
2. Esperar unos segundos para que descargue la actualización en segundo plano.
3. Cerrar completamente la aplicación.
4. Volver a abrirla. Si todavía aparece la versión anterior, repetir el cierre y la apertura una vez más.

El APK interno escucha `preview`. La aplicación instalada desde Google Play escucha `production`. Publicar una OTA no convierte un APK `preview` en una aplicación `production`.

### Cuándo una OTA no es suficiente

EAS Update sirve para cambios de JavaScript/TypeScript, estilos y recursos compatibles con el binario instalado. Se necesita generar un nuevo build cuando cambian, entre otros:

- dependencias con código nativo;
- plugins o configuración nativa de Expo;
- permisos de Android o iOS;
- iconos, splash u otra configuración que se integra durante la compilación;
- la versión de Expo SDK;
- la `runtimeVersion` o la versión de la aplicación.

Build interno de Android para `preview`:

```powershell
npx eas-cli build --platform android --profile preview
```

Build para distribución en producción:

```powershell
npx eas-cli build --platform android --profile production
```

Referencias oficiales: [EAS Update: primeros pasos](https://docs.expo.dev/eas-update/getting-started/) y [despliegue mediante canales](https://docs.expo.dev/eas-update/deployment/).
