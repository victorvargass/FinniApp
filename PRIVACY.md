# Política de privacidad de FinniApp

Vigente desde el 8 de septiembre de 2026.

FinniApp es una aplicación de finanzas personales que funciona principalmente en el dispositivo. No vende información personal, no incluye publicidad y no opera un servidor propio para almacenar los movimientos financieros del usuario.

## Información tratada

La aplicación permite registrar períodos, ingresos, gastos, categorías, límites, medios de pago, cuotas, deudas, ahorros, recurrencias y notas. Esta información se guarda localmente en una base SQLite del dispositivo.

Si el usuario decide conectar Google Drive, FinniApp accede al nombre, correo electrónico e identificador básico de su cuenta de Google y solicita acceso únicamente a la carpeta privada de datos de la aplicación (`drive.appdata`). La base financiera se transmite a Google Drive solamente cuando el usuario solicita un respaldo. El uso de Google es opcional y la aplicación puede utilizarse sin iniciar sesión.

## Finalidades

- Administrar y mostrar la información financiera ingresada por el usuario.
- Generar reportes PDF solicitados por el usuario.
- Programar recordatorios locales elegidos por el usuario.
- Crear y restaurar respaldos opcionales en Google Drive.

## Transferencias y terceros

Cuando se usa el respaldo, la información viaja mediante HTTPS directamente entre el dispositivo y Google Drive. El archivo se almacena en el espacio privado de la aplicación dentro de la cuenta del usuario. Se aplican las condiciones y la política de privacidad de Google. FinniApp no envía esta información a un servidor del desarrollador.

Los reportes PDF se generan localmente. Al generarlos, FinniApp solicita al sistema abrirlos en un lector PDF compatible. Solo salen del dispositivo si el usuario decide compartirlos, imprimirlos o guardarlos mediante el lector o el sistema.

## Conservación y eliminación

La información local permanece hasta que el usuario la elimina, restablece los datos de FinniApp o desinstala la aplicación. Desde Configuración se pueden borrar los datos locales. Al crear un respaldo nuevo, la aplicación intenta eliminar los respaldos anteriores de su carpeta privada. Cerrar sesión no elimina automáticamente el respaldo ya almacenado en Google Drive.

## Seguridad

FinniApp valida la integridad, el formato, el tamaño y la compatibilidad de los respaldos antes de restaurarlos. Mantiene una copia temporal de recuperación durante la restauración y utiliza conexiones cifradas HTTPS para Google Drive. La protección biométrica, cuando se activa, restringe el acceso a la interfaz; no debe interpretarse como cifrado de la base de datos local.

## Menores

FinniApp no está dirigida específicamente a menores de edad y no recopila deliberadamente información de menores mediante un servicio propio.

## Cambios y contacto

Esta política puede actualizarse cuando cambien las funciones o proveedores de la aplicación. Las consultas de privacidad pueden enviarse a victorvargassandoval93@gmail.com.

Antes de publicar en Google Play, esta política debe estar disponible en una URL HTTPS pública y enlazada desde la ficha y la aplicación.
