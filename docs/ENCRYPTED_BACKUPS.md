# Compatibilidad con respaldos cifrados de Google Drive

FinniApp puede restaurar respaldos históricos con el sobre cifrado
`FINNIAPP-BACKUP`. La creación actual de respaldos genera una copia SQLite sin
cifrado adicional administrado por FinniApp y la envía mediante HTTPS a la
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

Cuando se restaura un respaldo histórico cifrado, la contraseña debe estar
disponible en el dispositivo. No se sube a Drive ni a servidores de FinniApp.

## Compatibilidad

La restauración detecta el sobre cifrado `.finni`. Los respaldos SQLite `.db`
continúan pasando por las validaciones de tamaño, formato, esquema e integridad
y se pueden restaurar sin contraseña. Los respaldos creados por la versión
actual se guardan como `.db` en el espacio privado de la aplicación.

## Validación por candidata

1. Crear un respaldo actual y confirmar que se guarda como `.db` dentro de
   `appDataFolder`.
2. Restaurarlo en otro dispositivo de QA y comprobar la migración posterior.
3. Restaurar un respaldo histórico `.finni` con la contraseña correcta.
4. Comprobar que una contraseña incorrecta no reemplaza la base local.
5. Alterar un byte del archivo cifrado de prueba y comprobar que falla la
   autenticidad.
6. Confirmar que la política y Data Safety declaran que los respaldos actuales
   no incorporan cifrado adicional administrado por FinniApp.
