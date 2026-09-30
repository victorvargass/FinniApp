# Cobertura iOS

Expo SDK 54 soporta iOS 15.1 o superior. La candidata se construye como `.app`
de simulador mediante el perfil `e2e-test` (`ios.simulator: true`) y ejecuta los
recorridos críticos con `.eas/workflows/e2e-test-ios.yml`.

## Puerta automatizada

- Onboarding e inicio limpio.
- Ciclo de ingresos, gastos, búsqueda y cierre de período.
- Contacto, deuda y pago parcial.
- Tarjeta, compra en cuotas y conciliación.
- Preferencias, tema e idioma.

Google Drive autenticado queda fuera del simulador compartido porque necesita
una cuenta QA aislada. Su frontera sin credenciales sigue cubierta en Android y
la restauración se valida con pruebas de integración.

## Ronda en dispositivo real por candidata

| Caso | iPhone compacto | iPhone actual |
| --- | --- | --- |
| Instalación/actualización conservando datos | Pendiente | Pendiente |
| Face ID/Touch ID y retorno desde segundo plano | Pendiente | Pendiente |
| Notificaciones: permiso, entrega, toque y reinicio | Pendiente | Pendiente |
| Cambio de zona horaria y horario de verano | Pendiente | Pendiente |
| Teclado, selector de fecha/hora y texto grande | Pendiente | Pendiente |
| Exportar/compartir PDF y CSV | Pendiente | Pendiente |
| Respaldo/restauración con cuenta QA | Pendiente | Pendiente |

Se registra modelo, versión de iOS, versión/build de FinniApp y evidencia. Una
falla de datos, cálculo, bloqueo o duplicación impide promover la candidata.
