# Seguridad de dependencias

Revisión: 29 de septiembre de 2026. Base: Expo SDK 54.

Después de aplicar las actualizaciones transitivas compatibles mediante
`npm audit fix` —sin `--force`—, el inventario de producción bajó de 23 a 20
alertas: 18 moderadas, 2 altas y ninguna crítica. Se actualizaron, dentro de
rangos compatibles, `@react-navigation/core`, `js-yaml` y `undici`.

## Riesgos altos aceptados temporalmente

| Paquete | Ruta | Exposición en FinniApp | Decisión |
| --- | --- | --- | --- |
| `image-size` | Metro | Metro procesa los recursos incluidos por el equipo durante desarrollo/build; la app no entrega imágenes externas a este parser. La versión corregida requiere forzar una versión mayor fuera del rango de Metro de SDK 54. | No forzar. Revisar con el próximo parche compatible de Expo o la migración de SDK. |
| `postcss` | `@expo/metro-config` | Herramienta de construcción. FinniApp no acepta CSS o source maps de usuarios. La corrección propuesta por npm instala Expo 57 y rompe el contrato de SDK 54. | No forzar. Revisar en la migración planificada de Expo. |

## Alertas moderadas

- `decode-uri-component` llega mediante `expo-router` y `query-string`. La app
  no interpreta rutas web arbitrarias como contenido financiero, pero debe
  mantener validación estricta de parámetros de navegación.
- `uuid` llega mediante `xcode` y los plugins de configuración; se usa en la
  cadena de build, no para identificadores financieros dentro de la app.
- El resto son propagaciones de las cadenas Expo CLI/configuración. npm ofrece
  como corrección Expo 57, que no se aplicará sin una migración explícita.

## Control

- `npm run audit:security` falla si aparece una alerta crítica o una alerta
  alta distinta de las dos excepciones anteriores.
- `npx expo install --check` debe seguir indicando que las dependencias de SDK
  54 son compatibles.
- Próxima revisión obligatoria: antes del siguiente build de producción o el
  29 de octubre de 2026, lo que ocurra primero.
- Nunca ejecutar `npm audit fix --force` en `master`.
