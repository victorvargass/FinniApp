# Inventario de datos y borrador para Google Play Data Safety

Este documento describe el comportamiento observado en el código al 8 de septiembre de 2026. Debe revisarse nuevamente contra el binario final y todos sus SDK antes de responder el formulario de Play Console.

## Datos que permanecen en el dispositivo

- Información financiera: ingresos, gastos, deudas, cuotas, ahorros, límites y medios de pago descriptivos.
- Contenido generado por el usuario: nombres, acreedores y notas.
- Preferencias: tema, biometría, onboarding y recordatorios.

El procesamiento exclusivamente local no se declara normalmente como recopilación. No se almacenan números completos de tarjetas ni credenciales bancarias.

## Datos que pueden salir del dispositivo

| Dato | Cuándo | Destino | Finalidad | Obligatorio |
| --- | --- | --- | --- | --- |
| Nombre, correo e identificador de Google | Al conectar Google | Google Sign-In | Autenticación y visualización de sesión | No |
| Archivo SQLite con información financiera y notas | Al respaldar/restaurar | Carpeta `appDataFolder` de Google Drive | Funcionalidad de respaldo solicitada por el usuario | No |
| Reporte PDF | Al elegir compartir | Aplicación elegida por el usuario | Exportación iniciada por el usuario | No |

## Declaración preliminar

- La app funciona sin cuenta; Google Drive es opcional.
- No hay servidor propio, analítica, publicidad ni venta de datos detectados.
- El respaldo usa HTTPS en tránsito, pero no tiene cifrado de extremo a extremo administrado por FinniApp.
- Revisar en Play Console si la transferencia iniciada por el usuario hacia Google Drive califica para la excepción aplicable; la decisión final es responsabilidad del publicador.
- Declarar los SDK realmente incluidos por el artefacto de producción, no solo las importaciones visibles.

## Verificaciones antes de enviar

1. Publicar `PRIVACY.md` en una URL HTTPS estable y sin restricciones.
2. Enlazar esa URL dentro de la app y en Play Console.
3. Revisar permisos del Android App Bundle final.
4. Confirmar que no se añadió analítica, crash reporting o publicidad después de este inventario.
5. Repetir `npm audit` y revisar el índice de SDK de Google Play.
6. Probar eliminación local y documentar cómo borrar el respaldo de Drive.
