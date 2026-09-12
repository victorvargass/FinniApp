# Política de privacidad de FinniApp

Vigente desde el 12 de septiembre de 2026.

FinniApp es una aplicación de finanzas personales que funciona principalmente en el dispositivo. No vende información personal, no incluye publicidad ni analítica de terceros y no opera un servidor propio para almacenar los movimientos financieros del usuario.

## Información tratada

La aplicación permite registrar períodos, ingresos, gastos, categorías, límites, cuentas y tarjetas, saldos de referencia, transferencias, abonos, cuotas, deudas, metas de ahorro, recurrencias, notas y preferencias. Esta información se guarda localmente en una base SQLite del dispositivo. También conserva localmente hasta 20 códigos de diagnóstico técnico con fecha, zona del código y tipo de error; no incluyen mensajes de error, nombres, notas ni montos.

FinniApp no se conecta a bancos ni consulta datos de instituciones financieras. El usuario ingresa manualmente un saldo o cupo de referencia y su fecha. La aplicación calcula su evolución a partir de los movimientos registrados y permite conciliar el valor nuevamente.

Si el usuario decide conectar Google Drive, FinniApp accede al nombre, correo electrónico e identificador básico de su cuenta de Google y solicita acceso únicamente a la carpeta privada de datos de la aplicación (`drive.appdata`). La base financiera se transmite a Google Drive solamente cuando el usuario solicita un respaldo. El uso de Google es opcional y la aplicación puede utilizarse sin iniciar sesión.

## Finalidades

- Administrar y mostrar la información financiera ingresada por el usuario.
- Generar reportes PDF solicitados por el usuario.
- Programar recordatorios locales elegidos por el usuario.
- Crear y restaurar respaldos opcionales en Google Drive.
- Permitir el bloqueo local de la interfaz mediante la autenticación biométrica del sistema operativo.

## Transferencias y terceros

Cuando se usa el respaldo, la información viaja mediante HTTPS directamente entre el dispositivo y Google Drive. El archivo se almacena en el espacio privado de la aplicación dentro de la cuenta del usuario. Se aplican las condiciones y la política de privacidad de Google. FinniApp no envía esta información a un servidor del desarrollador.

Los reportes PDF se generan localmente. Al generarlos, FinniApp solicita al sistema abrirlos en un lector PDF compatible. Solo salen del dispositivo si el usuario decide compartirlos, imprimirlos o guardarlos mediante el lector o el sistema.

Al elegir “Soporte y comentarios”, FinniApp prepara un correo en la aplicación elegida por el usuario. El correo incluye hasta 20 códigos de diagnóstico técnico indicados anteriormente y se envía solo si el usuario decide hacerlo. Desde ese momento, el mensaje queda sujeto al proveedor de correo seleccionado.

Las notificaciones son opcionales y se programan localmente en el dispositivo. Cuando se activa el bloqueo biométrico, el sistema operativo realiza la verificación; FinniApp no recibe ni almacena la huella, el rostro ni una plantilla biométrica.

## Conservación y eliminación

La información local permanece hasta que el usuario la elimina, restablece los datos de FinniApp o desinstala la aplicación. Desde Configuración se pueden borrar los datos locales. Al crear un respaldo nuevo, la aplicación intenta eliminar los respaldos anteriores de su carpeta privada. Cerrar sesión no elimina automáticamente el respaldo ya almacenado en Google Drive; este permanece hasta ser reemplazado o eliminado desde la configuración de aplicaciones de Drive.

## Seguridad

FinniApp valida la integridad, el formato, el tamaño y la compatibilidad de los respaldos antes de restaurarlos. Mantiene una copia temporal de recuperación durante la restauración y utiliza conexiones HTTPS para Google Drive. La copia de la base de datos no incorpora cifrado adicional administrado por FinniApp. La protección biométrica, cuando se activa, restringe el acceso a la interfaz; no debe interpretarse como cifrado de la base de datos local.

## Menores

FinniApp no está dirigida específicamente a menores de edad y no recopila deliberadamente información de menores mediante un servicio propio.

## Cambios y contacto

Esta política puede actualizarse cuando cambien las funciones o proveedores de la aplicación. Las consultas de privacidad pueden enviarse a victorvargassandoval93@gmail.com.

Antes de publicar en Google Play, esta política debe estar disponible en una URL HTTPS pública y enlazada desde la ficha y la aplicación.
