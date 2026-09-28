# Cambios de base de datos

La base SQLite y la aplicación se publican juntas mediante EAS Update. Para que
una actualización sea compatible tanto con instalaciones existentes como con
instalaciones nuevas, todo cambio de inicialización o migración debe cumplir
este contrato:

1. Aumentar `DATABASE_SCHEMA_VERSION` en `lib/database-schema.ts`.
2. Agregar la versión siguiente, sin saltos, a `SCHEMA_MIGRATIONS` en
   `lib/schema-migrations.ts`.
3. Implementar la migración de forma idempotente dentro de
   `initializeDatabase`: debe funcionar si se reintenta después de un cierre.
4. Crear `tests/schema-migrations/vNN.test.mjs`. La prueba debe abrir una base
   con la estructura anterior, conservar datos representativos, aplicar el
   cambio y comprobar `PRAGMA foreign_key_check`. También debe cubrir una base
   limpia cuando el cambio modifica el esquema inicial.
5. Ejecutar `npm run check` antes de confirmar los cambios.

`npm run check:database-schema -- --base <commit>` compara el contrato actual
con el commit base. Si detecta un cambio de base de datos sin una versión nueva,
una entrada de migración o su prueba, termina con error.

## Publicación a master

Un push a `master` ya no publica inmediatamente. El workflow de EAS primero
instala las dependencias y ejecuta el contrato, lint, TypeScript y todas las
pruebas. El job OTA depende de ese resultado y solo publica en `preview` si
todo termina correctamente. Un fallo deja la actualización anterior activa.

GitHub Quality ejecuta el mismo contrato contra el commit anterior del push o
contra la base del pull request. Así el error aparece antes de Expo y queda
registrado junto al commit que lo produjo.
