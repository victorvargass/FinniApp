# Google Play: prueba interna de FinniApp 1.4.0

Este documento contiene las respuestas recomendadas según el código y las
dependencias revisadas el 4 de octubre de 2026. Deben verificarse otra vez
contra el App Bundle final antes de publicar.

## Ficha principal

- **Nombre:** FinniApp
- **Idioma predeterminado:** Español (Latinoamérica)
- **Tipo:** Aplicación
- **Categoría:** Finanzas
- **Correo de soporte:** victorvargassandoval93@gmail.com
- **URL de privacidad preparada:**
  `https://victorvargass.github.io/FinniApp/privacy.html` (usar solo después de
  confirmar que GitHub Pages responde públicamente).
- **Descripción breve:** Organiza gastos, ingresos, cuentas, ahorros y deudas en un solo lugar.
- **Descripción completa:**

  FinniApp te ayuda a ordenar tus finanzas personales directamente en tu
  dispositivo. Registra ingresos y gastos, administra cuentas y tarjetas,
  controla deudas y compras en cuotas, y sigue tus metas de ahorro sin conectar
  la aplicación a tu banco.

  Crea períodos personalizados, clasifica movimientos, revisa tu historial y
  genera reportes PDF. También puedes programar recordatorios locales y, en
  Android, activar voluntariamente la detección de posibles movimientos desde
  notificaciones para revisarlos antes de guardarlos.

  Tus datos financieros se almacenan localmente en una base cifrada. Si lo
  deseas, puedes conectar Google Drive para guardar hasta tres respaldos en la
  carpeta privada de FinniApp y restaurarlos en otro dispositivo.

  FinniApp no se conecta a instituciones financieras, no realiza pagos ni
  transferencias reales, no incluye publicidad y no vende tus datos.

## Declaraciones de contenido

- **Contiene anuncios:** No.
- **Acceso a la aplicación:** todas las funciones principales se pueden revisar
  sin cuenta. Google Sign-In solo es necesario para el respaldo opcional en
  Drive; no se deben entregar credenciales de acceso a Google a revisores.
- **Audiencia objetivo recomendada:** 18 años o más. La aplicación no está
  diseñada ni promocionada para niños.
- **Aplicación de noticias:** No.
- **Aplicación gubernamental:** No.
- **Funciones de salud:** No.
- **Clasificación de contenido:** responder según el comportamiento real: sin
  violencia, sexualidad, lenguaje ofensivo, apuestas, compras digitales ni
  interacción pública entre usuarios. El contenido escrito por la persona es
  privado y no se publica.

## Declaración de funciones financieras

Seleccionar **Otros** y describir:

> Herramienta de administración de finanzas personales. La persona registra
> manualmente sus movimientos, cuentas, tarjetas, deudas, cuotas y ahorros.
> FinniApp no ofrece productos financieros, préstamos, asesoría financiera,
> pagos, billetera, transferencias de dinero ni conexión bancaria.

No seleccionar “Banking”, “Money transfer”, “Personal loans” ni “Financial
advice”: los nombres de cuentas, transferencias y deudas son registros privados
creados por el usuario, no servicios financieros ofrecidos por FinniApp.

## Seguridad de datos

Para una pista exclusivamente interna, Google Play actualmente exime el
formulario Data Safety. Antes de pasar a prueba cerrada o producción, usar
`docs/DATA_SAFETY.md` y confirmar estas respuestas:

- No hay publicidad, venta de datos ni analítica de uso.
- La información financiera y las sugerencias derivadas de notificaciones se
  procesan localmente y no se envían al desarrollador.
- Google Sign-In usa nombre, correo e identificador para autenticación opcional.
- El respaldo opcional envía la copia financiera a la carpeta privada
  `appDataFolder` de Google Drive mediante HTTPS. La copia actual no incorpora
  cifrado adicional administrado por FinniApp.
- Sentry recibe datos de fallos y diagnóstico solo después de consentimiento;
  está configurado sin PII, capturas, replay, breadcrumbs ni trazas.
- Los datos se cifran en tránsito. La base local usa SQLCipher.
- La persona puede borrar los datos locales desde Configuración; los respaldos
  de Drive se eliminan desde la configuración de aplicaciones de Google Drive.

## Permisos y accesos especiales

- `POST_NOTIFICATIONS`: recordatorios y avisos locales opcionales.
- `RECEIVE_BOOT_COMPLETED`: restauración de recordatorios programados después
  de reiniciar el dispositivo.
- `SCHEDULE_EXACT_ALARM`: recordatorios solicitados para una fecha y hora.
- Servicio protegido por `BIND_NOTIFICATION_LISTENER_SERVICE`: acceso especial
  y revocable para procesar localmente notificaciones de otras aplicaciones.
  Antes de abrir Ajustes de Android, FinniApp muestra una divulgación destacada
  sobre los datos accedidos, su uso, conservación y ausencia de transmisión.
- Biometría: Android realiza la autenticación; FinniApp no recibe plantillas
  biométricas.

No se esperan permisos de contactos del sistema, SMS, llamadas, ubicación,
cámara, micrófono ni almacenamiento compartido. Confirmar esto en el manifiesto
fusionado del AAB final y en **Explorador de App Bundle > Permisos**.

## Recursos gráficos pendientes

- Ícono de Play Store de 512 × 512 px.
- Gráfico destacado de 1024 × 500 px.
- Al menos dos capturas de teléfono actuales, sin datos financieros personales.
- Recomendado: cuatro capturas verticales de 1080 px o más mostrando Inicio,
  Movimientos, Deudas y Configuración/privacidad.

No usar las capturas de producción compartidas durante el desarrollo si
contienen nombres, montos, cuentas o saldos reales.

## Publicación interna

1. Crear la aplicación con el paquete `com.vitoco18.FinniApp`.
2. Activar Play App Signing y conservar las credenciales de carga de EAS.
3. Ir a **Prueba y lanzamiento > Pruebas > Prueba interna**.
4. Crear una versión y subir el `.aab` generado por el perfil `production`.
5. Usar como nombre de versión `1.4.0 (internal 1)` y describir los cambios
   principales de la candidata.
6. Agregar los correos de testers, publicar la pista y compartir el enlace de
   participación.
7. La primera instalación desde Google Play puede requerir desinstalar una vez
   el APK distribuido manualmente si Play App Signing utiliza otra firma.

## Hallazgo de seguridad pendiente

El 4 de octubre de 2026, `npm run audit:security` informó alertas altas en el
árbol de Expo SDK 54, React Native, Metro, Google Sign-In y Sentry. `npm audit`
propone saltos incompatibles o retrocesos de versión en lugar de una corrección
compatible con SDK 54. La candidata interna puede usarse para QA controlado,
pero no debe promoverse a una pista pública hasta documentar la exposición real
y aplicar versiones corregidas compatibles, sin ejecutar `npm audit fix --force`.
