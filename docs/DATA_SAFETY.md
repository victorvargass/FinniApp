# Inventario de datos y borrador para Google Play Data Safety

Este documento describe el comportamiento observado en el código al 4 de octubre de 2026. Debe revisarse nuevamente contra el binario final y todos sus SDK antes de responder el formulario de Play Console.

## Datos que permanecen en el dispositivo

- Información financiera: ingresos, gastos, deudas, cuotas, ahorros, límites y medios de pago descriptivos.
- Contenido generado por el usuario: nombres, acreedores y notas.
- Preferencias: tema, biometría, onboarding y recordatorios.

La base financiera local y las copias previas a una migración de esquema se
cifran con SQLCipher. La clave local se guarda mediante el almacén seguro del
sistema y no se incluye en el archivo de base de datos.

El procesamiento exclusivamente local no se declara normalmente como recopilación. No se almacenan números completos de tarjetas ni credenciales bancarias.

## Datos que pueden salir del dispositivo

| Dato | Cuándo | Destino | Finalidad | Obligatorio |
| --- | --- | --- | --- | --- |
| Nombre, correo e identificador de Google | Al conectar Google | Google Sign-In | Autenticación y visualización de sesión | No |
| Copia de la base financiera sin cifrado adicional administrado por FinniApp | Al respaldar/restaurar | Carpeta privada `appDataFolder` de Google Drive, mediante HTTPS | Funcionalidad de respaldo solicitada por el usuario | No |
| Reporte PDF | Al generarlo y abrirlo | Lector PDF elegido por el sistema; puede enviarse a otra aplicación por decisión posterior del usuario | Exportación iniciada por el usuario | No |
| Códigos técnicos sin datos financieros | Al abrir soporte y enviar el correo preparado | Aplicación de correo y cuenta de soporte | Diagnóstico solicitado por el usuario | No |
| Crash, bloqueo, stack sin variables, versión, sistema y modelo general | Solo después de aceptar “Ayudar a detectar fallos” | Sentry | Estabilidad y diagnóstico de la aplicación | No |

## Declaración preliminar

- La app funciona sin cuenta; Google Drive es opcional.
- No hay servidor propio, analítica de uso, publicidad ni venta de datos. El monitoreo técnico opcional usa Sentry y debe declararse como datos de rendimiento/diagnóstico según el formulario vigente.
- Los respaldos usan HTTPS y la carpeta privada `appDataFolder`, pero la copia subida no incorpora cifrado adicional administrado por FinniApp.
- Con autorización especial de Android, el listener accede localmente al título y contenido de notificaciones de otras aplicaciones para detectar posibles movimientos. Solo guarda la sugerencia derivada y no transmite esos datos fuera del dispositivo.
- Revisar en Play Console si la transferencia iniciada por el usuario hacia Google Drive califica para la excepción aplicable; la decisión final es responsabilidad del publicador.
- Declarar los SDK realmente incluidos por el artefacto de producción, no solo las importaciones visibles.

## Verificaciones antes de enviar

1. Publicar `PRIVACY.md` en una URL HTTPS estable y sin restricciones.
2. Enlazar esa URL dentro de la app y en Play Console.
3. Revisar permisos del Android App Bundle final.
4. Confirmar que Sentry sigue desactivado por defecto, sujeto a consentimiento y sin replay, capturas, PII ni datos financieros.
5. Repetir `npm audit` y revisar el índice de SDK de Google Play.
6. Probar eliminación local y documentar cómo borrar el respaldo de Drive.
7. Ejecutar la matriz de cifrado y restauración de `docs/ENCRYPTED_BACKUPS.md`.
8. Ejecutar la migración y segundo arranque de `docs/LOCAL_DATABASE_ENCRYPTION.md`.

## Permisos Android revisados

- `POST_NOTIFICATIONS`: Android lo solicita al usuario cuando activa recordatorios. La app funciona sin concederlo.
- `RECEIVE_BOOT_COMPLETED`: `expo-notifications` lo incorpora para restaurar notificaciones programadas después de reiniciar el dispositivo.
- `SCHEDULE_EXACT_ALARM`: se conserva porque los recordatorios de movimientos se programan para una hora elegida por el usuario. Expo SDK 54 lo requiere en Android 12 o superior para disparar una notificación local a una hora exacta.
- `BIND_NOTIFICATION_LISTENER_SERVICE`: protege el servicio opcional que, después de una divulgación destacada y autorización explícita en Ajustes de Android, procesa localmente notificaciones para proponer movimientos. No se conserva el texto completo y el acceso puede revocarse en cualquier momento.

Esta justificación debe volver a comprobarse si los recordatorios dejan de usar una hora exacta; en ese caso conviene retirar `SCHEDULE_EXACT_ALARM` del manifiesto.
