# Cifrado de la base local

FinniApp usa SQLCipher para cifrar la base SQLite y las copias locales creadas
antes de una migración de esquema. La clave aleatoria de 256 bits se genera en
el dispositivo y se conserva con Expo SecureStore; nunca se escribe dentro de
la base ni se incorpora a un respaldo.

## Actualización desde una versión anterior

1. Antes de abrir una base existente, la aplicación inspecciona únicamente su
   cabecera para distinguir SQLite plano de SQLCipher.
2. Si está en texto plano, crea una base cifrada separada y copia esquema,
   datos y metadatos mediante `sqlcipher_export`.
3. Verifica cantidad de objetos, integridad, identificador de FinniApp y versión
   del esquema.
4. Conserva el original como rollback, mueve la base validada a la ruta activa
   y vuelve a abrirla con la clave local.
5. Solo después de validar la base activa elimina el rollback en texto plano.

Una interrupción antes del reemplazo deja el original utilizable. Si ocurre
entre el renombrado y el reemplazo, el siguiente inicio recupera el rollback.
La aplicación muestra una pantalla de error con reintento en vez de quedar
indefinidamente en “Cargando período”.

## Recuperación y límites

- Android desactiva `allowBackup` para evitar restaurar una base cifrada sin su
  clave del almacén seguro.
- Borrar los datos de la app o desinstalarla elimina la base local. Para cambiar
  de teléfono se debe usar el respaldo cifrado de Google Drive y conservar su
  contraseña.
- Si la base existe pero la clave local no, FinniApp no intenta sobrescribirla;
  muestra el error recuperable para permitir actualizar o restaurar un respaldo.
- La biometría bloquea la interfaz. SQLCipher protege el archivo en reposo; son
  controles distintos.

## Matriz por candidata

- [ ] Instalación limpia crea una base cuyo encabezado no contiene
  `SQLite format 3`.
- [ ] Actualización con el fixture v27 conserva períodos, movimientos y saldos,
  y termina en la versión de esquema vigente.
- [ ] Cerrar y abrir la app reutiliza la clave y muestra los mismos datos.
- [ ] La copia `pre-migration-v*.db` tampoco contiene una cabecera SQLite plana.
- [ ] Una base cifrada sin su clave muestra la pantalla de recuperación y no se
  reemplaza ni elimina.
- [ ] Un archivo corrupto muestra la misma salida controlada sin bucle de carga.
- [ ] Restaurar un respaldo cifrado y uno legado produce una base local cifrada.
- [ ] Android release e iOS release se compilan con SQLCipher habilitado.

La activación de SQLCipher cambia código nativo: después de modificar su
configuración se debe regenerar o recompilar el proyecto nativo; un APK antiguo
no sirve para validar este flujo.
