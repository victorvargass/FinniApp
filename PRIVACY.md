# Política de privacidad de FinniApp

Vigente desde el 4 de octubre de 2026.

FinniApp es una aplicación de finanzas personales que funciona principalmente en el dispositivo. No vende información personal, no incluye publicidad ni analítica de terceros y no opera un servidor propio para almacenar los movimientos financieros del usuario.

## Información tratada

La aplicación permite registrar períodos, ingresos, gastos, categorías, límites, cuentas y tarjetas, montos de referencia, transferencias, abonos, cuotas, deudas, metas de ahorro, recurrencias, notas y preferencias. Esta información se guarda localmente en una base SQLite cifrada en el dispositivo. También conserva localmente hasta 20 códigos de diagnóstico técnico con fecha, zona del código y tipo de error; no incluyen mensajes de error, nombres, notas ni montos.

En Android, si el usuario concede voluntariamente el acceso especial a notificaciones, FinniApp puede analizar en el dispositivo notificaciones de otras aplicaciones para proponer movimientos. Solo guarda como sugerencia el nombre detectado, monto, fecha y hora, aplicación de origen y tipo probable; no conserva el texto completo de la notificación. Estas sugerencias permanecen cifradas en el almacenamiento privado local hasta que se registran o eliminan. No se envían a Sentry ni a un servidor del desarrollador. El acceso puede revocarse en cualquier momento desde la configuración de Android.

FinniApp no se conecta a bancos ni consulta datos de instituciones financieras. El usuario ingresa manualmente un saldo o cupo de referencia y su fecha. La aplicación calcula su evolución a partir de los movimientos registrados y permite conciliar el valor nuevamente.

Si el usuario decide conectar Google Drive, FinniApp accede al nombre, correo electrónico e identificador básico de su cuenta de Google y solicita acceso únicamente a la carpeta privada de datos de la aplicación (`drive.appdata`). La base financiera se transmite a Google Drive solamente cuando el usuario solicita un respaldo. El uso de Google es opcional y la aplicación puede utilizarse sin iniciar sesión.

## Finalidades

- Administrar y mostrar la información financiera ingresada por el usuario.
- Generar reportes PDF solicitados por el usuario.
- Programar recordatorios locales elegidos por el usuario.
- Proponer, con autorización previa en Android, movimientos detectados desde notificaciones para que el usuario los revise antes de registrarlos.
- Crear y restaurar respaldos opcionales en Google Drive.
- Permitir el bloqueo local de la interfaz mediante la autenticación biométrica del sistema operativo.
- Detectar crashes y bloqueos técnicos, únicamente cuando el usuario da su consentimiento.

## Transferencias y terceros

Cuando se usa el respaldo, una copia de la base financiera viaja mediante HTTPS directamente a Google Drive y se almacena en el espacio privado de la aplicación dentro de la cuenta del usuario. Esta copia no incorpora cifrado adicional administrado por FinniApp. Se aplican las medidas de seguridad, condiciones y política de privacidad de Google. FinniApp no envía esta información a un servidor del desarrollador.

Los reportes PDF se generan localmente. Al generarlos, FinniApp solicita al sistema abrirlos en un lector PDF compatible. Solo salen del dispositivo si el usuario decide compartirlos, imprimirlos o guardarlos mediante el lector o el sistema.

Al elegir “Soporte y comentarios”, FinniApp prepara un correo en la aplicación elegida por el usuario. El correo incluye hasta 20 códigos de diagnóstico técnico indicados anteriormente y se envía solo si el usuario decide hacerlo. Desde ese momento, el mensaje queda sujeto al proveedor de correo seleccionado.

Las notificaciones son opcionales y se programan localmente en el dispositivo. Cuando se activa el bloqueo biométrico, el sistema operativo realiza la verificación; FinniApp no recibe ni almacena la huella, el rostro ni una plantilla biométrica.

El monitoreo técnico de fallos también es opcional y está desactivado por defecto. Si el usuario lo activa en Preferencias, FinniApp utiliza Sentry para recibir el tipo de excepción, stack trace sin variables locales, versión de la aplicación, sistema operativo y modelo general del dispositivo. Antes del envío se eliminan mensajes, usuario, peticiones, navegación, datos adicionales y contextos personalizados. No se envían nombres, montos, notas, movimientos, cuentas, respaldos, capturas de pantalla ni grabaciones de sesión. El consentimiento se puede retirar en cualquier momento desde la misma preferencia.

## Conservación y eliminación

La información local permanece hasta que el usuario la elimina, restablece los datos de FinniApp o desinstala la aplicación. Desde Configuración se pueden borrar los datos locales; esa acción también retira el consentimiento de monitoreo técnico. FinniApp conserva hasta tres respaldos en su carpeta privada de Google Drive e intenta eliminar los más antiguos al crear uno nuevo. Cerrar sesión no elimina automáticamente los respaldos ya almacenados; permanecen hasta ser reemplazados por la rotación o eliminados desde la configuración de aplicaciones de Drive. Los eventos técnicos ya enviados a Sentry se conservan según la retención configurada para ese proyecto.

## Seguridad

FinniApp cifra la base local con SQLCipher y una clave aleatoria de 256 bits guardada mediante el almacén seguro del sistema operativo. Al actualizar desde una versión anterior, convierte la base existente sin borrar los movimientos y valida el resultado antes de reemplazar el archivo original. Para respaldar en Google Drive exporta temporalmente una copia SQLite compatible con restauración; esa copia se transmite mediante HTTPS a la carpeta privada de la aplicación, pero no incorpora cifrado adicional administrado por FinniApp. Antes de reemplazar datos durante una restauración, FinniApp valida el formato, tamaño, compatibilidad e integridad SQLite y conserva una copia temporal de recuperación. La protección biométrica restringe la interfaz y complementa, pero no reemplaza, el cifrado del archivo local.

## Menores

FinniApp no está dirigida específicamente a menores de edad y no recopila deliberadamente información de menores mediante un servicio propio.

## Cambios y contacto

Esta política puede actualizarse cuando cambien las funciones o proveedores de la aplicación. Las consultas de privacidad pueden enviarse a victorvargassandoval93@gmail.com.

Antes de publicar en Google Play, esta política debe estar disponible en una URL HTTPS pública y enlazada desde la ficha y la aplicación.
