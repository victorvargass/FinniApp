# Respaldos cifrados de Google Drive

Los respaldos nuevos se cifran en el dispositivo antes de enviarse a la
carpeta privada `appDataFolder` de Google Drive.

## Formato y controles

- Sobre versionado con cabecera `FINNIAPP-BACKUP`.
- XChaCha20-Poly1305 para confidencialidad e integridad autenticada.
- Clave de 256 bits derivada de la contraseña mediante PBKDF2-HMAC-SHA-256,
  sal aleatoria de 128 bits y 310.000 iteraciones.
- Nonce aleatorio de 192 bits por respaldo.
- Cabecera incluida como datos autenticados: alterar parámetros o contenido
  invalida el archivo completo.
- La clave derivada y el SQLite temporal no se envían a logs ni a Sentry.

La contraseña queda asociada localmente a la cuenta Google en SecureStore para
permitir el respaldo automático. No se sube a Drive ni a servidores de
FinniApp. En otro dispositivo debe ingresarse nuevamente y no existe un flujo
de recuperación si se pierde.

## Compatibilidad

La restauración detecta el sobre cifrado. Los respaldos históricos `.db`
continúan pasando por la validación SQLite anterior y se pueden restaurar sin
contraseña. Todos los respaldos creados por esta versión se guardan como
`.finni`; no existe una opción para crear nuevas copias sin cifrar.

## Validación por candidata

1. Configurar una contraseña ficticia y crear un respaldo.
2. Confirmar que el archivo remoto termina en `.finni` y no contiene la
   cabecera `SQLite format 3` en claro.
3. Restaurarlo con la contraseña correcta en otro dispositivo de QA.
4. Comprobar que una contraseña incorrecta no reemplaza la base local.
5. Alterar un byte del archivo de prueba y comprobar que falla la autenticidad.
6. Restaurar un respaldo SQLite legado y comprobar la migración posterior.
7. Verificar que el respaldo automático se omite antes de configurar la
   contraseña y funciona después de hacerlo.
