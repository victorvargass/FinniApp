# Compilar FinniApp para Android e iOS con EAS

## Configuración incluida en el proyecto

- Nombre visible: `FinniApp`
- Android package estable: `com.vitoco18.GastosApp`
- iOS bundle identifier estable: `com.vitoco18.GastosApp`
- Los identificadores nativos se conservan para que las actualizaciones sigan accediendo a los datos locales existentes.
- `preview`: distribución interna, genera APK en Android e IPA ad hoc en iOS.
- `ios-simulator`: genera una aplicación para iOS Simulator.
- `production`: genera artefactos destinados a Google Play y App Store Connect.
- Face ID tiene su mensaje de permiso configurado.
- El icono iOS es PNG RGB de 1024 x 1024, sin transparencia.
- Google Sign-In para iOS se configura mediante `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## 1. Actualizar herramientas locales

Expo Doctor requiere Node.js 20.19.4 o superior. Después de actualizar Node:

```bash
npm install
npm install --global eas-cli
eas login
eas whoami
```

## 2. Crear el cliente OAuth de iOS para Google Drive

En el mismo proyecto de Google Cloud usado por Android:

1. Abre **APIs y servicios > Credenciales**.
2. Crea un **ID de cliente de OAuth**.
3. Selecciona **iOS**.
4. Usa como Bundle ID: `com.vitoco18.GastosApp`.
5. Copia el Client ID completo, por ejemplo:
   `123456789-abc.apps.googleusercontent.com`.

Guárdalo en EAS como variable pública para cada ambiente que vayas a compilar:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "TU_CLIENT_ID_IOS" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "TU_CLIENT_ID_IOS" --visibility plaintext
```

Para desarrollo también puedes añadirlo al ambiente `development`.

## 3. Validar antes de compilar

```bash
npx expo-doctor
npx tsc --noEmit
npm run lint
npx expo config --type public
```

## 4. Preview para un iPhone físico

Una preview instalada directamente en iPhone requiere una membresía activa de Apple Developer. Primero registra cada dispositivo:

```bash
eas device:create
eas device:list
```

Abre en el iPhone el enlace entregado por `eas device:create` y completa el registro. Luego genera el IPA:

```bash
eas build -p ios --profile preview
```

En la primera compilación, EAS pedirá iniciar sesión en Apple y ofrecerá crear o reutilizar el certificado y el provisioning profile. Conviene permitir que EAS administre las credenciales.

Solo los dispositivos incluidos en el provisioning profile podrán instalar esa preview. Si agregas otro iPhone, debes crear una nueva build o volver a firmar la existente.

## 5. Android e iOS al mismo tiempo

Después de configurar Google OAuth y registrar al menos un iPhone:

```bash
eas build -p all --profile preview
```

Este comando genera dos builds independientes:

- Android: un APK instalable.
- iOS: un IPA ad hoc instalable únicamente en los dispositivos registrados.

## 6. Build para iOS Simulator

No requiere Apple Developer, pero el Simulator solo puede ejecutarse en macOS:

```bash
eas build -p ios --profile ios-simulator
```

En un Mac puedes instalar la última build con:

```bash
eas build:run -p ios --latest
```

La build de Simulator es un `.app`; no se instala en un iPhone físico.

## 7. Revisar credenciales

```bash
eas credentials -p android
eas credentials -p ios
```

No reemplaces el keystore Android existente. En iOS, EAS puede crear y administrar el certificado de distribución y los provisioning profiles.

## 8. TestFlight y App Store

Cuando la preview funcione correctamente:

1. Crea la app en App Store Connect con el Bundle ID `com.vitoco18.GastosApp`.
2. Verifica que la variable Google iOS exista en el ambiente `production`.
3. Genera la build de producción:

```bash
eas build -p ios --profile production
```

4. Envíala a App Store Connect/TestFlight:

```bash
eas submit -p ios --latest
```

Una build de producción no se instala directamente desde el enlace de EAS; se distribuye mediante TestFlight o App Store.

## 9. Workflow de producción para ambas plataformas

El proyecto incluye `.eas/workflows/create-production-builds.yml`. Este workflow ejecuta en paralelo las builds de producción de Android e iOS.

Antes de ejecutarlo por primera vez, configura las credenciales de ambos perfiles:

```bash
eas credentials:configure-build -p android -e production
eas credentials:configure-build -p ios -e production
```

Luego inicia el workflow manualmente:

```bash
eas workflow:run .eas/workflows/create-production-builds.yml
```

El workflow genera las builds, pero no las envía automáticamente a Google Play ni a App Store Connect.

## Comandos rápidos

```bash
# Preview Android
eas build -p android --profile preview

# Preview iPhone físico
eas build -p ios --profile preview

# Preview Android + iPhone
eas build -p all --profile preview

# iOS Simulator
eas build -p ios --profile ios-simulator

# Producción iOS
eas build -p ios --profile production

# Producción Android + iOS mediante EAS Workflows
eas workflow:run .eas/workflows/create-production-builds.yml
```
