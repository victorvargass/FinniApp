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
