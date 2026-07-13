# Migrar de better-sqlite3 a Turso/libSQL

Copia este prompt completo al agente de programación.

---

Actúa como senior backend/full-stack engineer especializado en Next.js App Router, Vercel, Turso/libSQL, SQLite y migraciones de bases de datos.

Debes corregir el deployment de "AI Financials for CPA Web" migrando la persistencia desde `better-sqlite3` local hacia Turso/libSQL.

No rediseñes la aplicación ni cambies el workflow financiero. El objetivo es reemplazar únicamente la infraestructura de base de datos, conservar el comportamiento existente y comprobar el flujo completo en Vercel.

## Contexto confirmado

El último deployment de Vercel falla durante el build porque `package.json` contiene:

```json
"engines": {
  "node": ">=26.5.0 <27"
}
```

El log de Vercel solicita:

```json
"engines": {
  "node": "24.x"
}
```

Un deployment anterior sí compiló, pero falló al importar transacciones:

```
SqliteError: attempt to write a readonly database
code: SQLITE_READONLY
route: /api/import
```

La causa es que la aplicación intenta escribir `data/app.db` dentro del filesystem de una función serverless.

## Solución aprobada

- Usar Turso como base de datos persistente en producción.
- Usar libSQL como cliente SQL.
- Eliminar `better-sqlite3`.
- No guardar la base en el filesystem de Vercel.
- Mantener una base libSQL local para desarrollo y tests.
- Mantener el esquema, migraciones, relaciones y comportamiento actuales.
- Mantener Next.js con runtime Node.js.
- No convertir las rutas a Edge Runtime.
- No agregar ORM si no es necesario.

## Antes de editar

1. Ejecuta `git status` y `git diff`.
2. Preserva todos los cambios locales existentes.
3. Inspecciona todas las llamadas actuales a `getDb()`.
4. Identifica usos de:
   - `.prepare()`
   - `.get()`
   - `.all()`
   - `.run()`
   - `db.transaction()`
   - `db.exec()`
5. Presenta un plan breve antes de implementar.
6. Agrega tests de regresión.
7. No crees credenciales ficticias ni expongas tokens.

## Fase 1 — Node compatible con Vercel

Cambiar:

```json
"engines": {
  "node": "24.x"
}
```

Actualizar `.nvmrc` a una versión disponible de Node 24 compatible con Vercel.

Mantener sincronizados:

- `.nvmrc`
- `package.json`
- documentación del README

No usar Node 26.

Verificar que:

```bash
pnpm install
pnpm build
```

funcionen con Node 24.

## Fase 2 — Dependencias

Eliminar:

```
better-sqlite3
@types/better-sqlite3
```

Agregar:

```
@libsql/client
```

No instalar Prisma, Drizzle ni otro ORM para esta migración.

El objetivo es conservar SQL explícito y minimizar cambios.

## Fase 3 — Configuración del cliente

Reemplazar `src/lib/db.ts` por un cliente libSQL.

Variables:

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
DATABASE_PATH
```

Comportamiento:

**Producción/Vercel:**

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

**Desarrollo y tests sin credenciales de Turso:**

```
DATABASE_PATH=/ruta/local/app.db
```

La URL local debe construirse como:

```
file:/ruta/local/app.db
```

Requisitos:

- Crear una sola instancia reutilizable del cliente.
- No abrir una conexión nueva por cada query.
- No inicializar Turso en build time de forma que `next build` falle.
- Inicializar el cliente de manera lazy.
- Si producción no tiene credenciales, devolver un error explícito: `Turso database credentials are not configured`.
- No mostrar el token en logs.
- No aplicar `journal_mode = WAL` contra Turso.
- Mantener `foreign_keys` únicamente si el driver remoto lo soporta y es necesario.
- Exportar una API pequeña y clara, por ejemplo:

```ts
getDb()
execute()
queryOne()
queryMany()
batch()
runMigrations()
```

No intentar imitar toda la API de `better-sqlite3` con un wrapper complejo.

## Fase 4 — Convertir acceso síncrono a asíncrono

Todas las operaciones libSQL son asíncronas.

Convertir:

```ts
const db = getDb();
const row = db.prepare(sql).get(id);
```

a un patrón equivalente:

```ts
const db = await getDb();
const result = await db.execute({
  sql,
  args: [id],
});
const row = result.rows[0] ?? null;
```

Convertir todas las rutas afectadas:

- `/api/companies`
- `/api/companies/[id]`
- `/api/workspaces`
- `/api/accounts`
- `/api/accounts/[id]`
- `/api/upload`, si consulta datos
- `/api/import`
- `/api/transactions`
- `/api/classifications`
- `/api/export/workbook`
- `/api/export/memo`, si usa la base

Requisitos:

- Usar argumentos parametrizados.
- No concatenar valores del usuario dentro del SQL.
- Convertir explícitamente valores retornados por libSQL:
  - `string`
  - `number`
  - `null`
  - booleanos almacenados como 0/1
- Crear funciones de mapping para Company, Workspace, BankAccount, Transaction y Classification.
- Evitar `as any` cuando sea posible.
- Mantener las respuestas JSON actuales para no romper el frontend.

## Fase 5 — Transacciones atómicas

Actualmente la importación crea:

1. `uploaded_statement`
2. múltiples `transactions`
3. múltiples `classifications`

Estas escrituras deben seguir siendo atómicas.

Usar la API documentada de batch/transaction de libSQL.

La operación completa debe cumplir:

- Si falla una fila, no dejar un statement parcial.
- Si falla una clasificación, no dejar la transacción sin clasificación.
- La detección de archivo duplicado debe ejecutarse antes del batch.
- El registro del statement y sus movimientos debe confirmarse en una sola transacción lógica.
- Las actualizaciones masivas de clasificación deben ser atómicas.
- Exportar y marcar workspace completed también debe manejarse de forma consistente.

No reemplazar transacciones con varios `execute()` independientes sin rollback.

## Fase 6 — Migraciones para Turso

Conservar el esquema existente:

- `_migrations`
- `companies`
- `workspaces`
- `bank_accounts`
- `uploaded_statements`
- `transactions`
- `classifications`
- `classification_rules`
- `review_events`
- `report_exports`

Adaptar las migraciones para libSQL.

Requisitos:

- Migraciones idempotentes.
- `CREATE TABLE IF NOT EXISTS`.
- `CREATE INDEX IF NOT EXISTS`.
- Registrar cada migración en `_migrations`.
- Manejar dos instancias serverless ejecutando inicialización simultáneamente.
- Usar `INSERT OR IGNORE` al registrar una migración cuando corresponda.
- No depender de un archivo local preexistente.
- Una base Turso vacía debe inicializarse automáticamente o mediante un comando documentado.
- Agregar un script explícito:

```bash
pnpm db:migrate
```

El script debe:

- Validar credenciales.
- Aplicar migraciones.
- Mostrar únicamente nombres de migraciones.
- Nunca imprimir `TURSO_AUTH_TOKEN`.
- Terminar con exit code distinto de cero si falla.

No ejecutar migraciones destructivas durante `next build`.

## Fase 7 — Desarrollo y tests locales

Los tests no deben conectarse a la base Turso de producción.

Configurar:

```
DATABASE_PATH=<archivo temporal único>
```

Para Vitest:

- Crear una base temporal por suite o worker.
- Ejecutar migraciones antes de los tests.
- Cerrar el cliente después.
- Eliminar:
  - archivo principal
  - `-wal`
  - `-shm`, si existen
- No depender de `TURSO_DATABASE_URL`.
- No requerir acceso a internet.

Para Playwright:

- Crear un path temporal único por ejecución.
- Limpiar la base antes de iniciar el servidor.
- No reutilizar `/tmp/ai-financials-e2e.db` sin eliminarlo.
- Ejecutar el E2E dos veces consecutivas para comprobar aislamiento.

Adaptar `resetDb()` y `closeDb()` al cliente libSQL.

## Fase 8 — Configurar Turso

Si no existe una base Turso, detenerse y solicitar autorización o credenciales antes de crear recursos externos.

Pasos esperados mediante Turso CLI o dashboard:

```bash
turso db create ai-financials-cpa
turso db show --url ai-financials-cpa
turso db tokens create ai-financials-cpa
```

Guardar localmente:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Nunca:

- Mostrar el token completo.
- Escribirlo en documentación.
- Agregarlo a Git.
- Guardarlo en código.
- Incluirlo en screenshots o logs.

Agregar `.env.example`:

```
# Production/remote database
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Local development fallback
DATABASE_PATH=./data/app.db
```

## Fase 9 — Configurar Vercel

Agregar a Vercel:

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

Configurar ambos para:

- Production
- Preview

No establecer:

```
DATABASE_PATH=data/app.db
```

en Vercel.

Después de configurar las variables:

1. Ejecutar migraciones contra Turso.
2. Crear un nuevo preview deployment.
3. Verificar el preview.
4. Solo entonces desplegar o promover a producción.

No realizar un deployment productivo sin verificar primero el preview.

## Fase 10 — Manejo de errores

Cuando Turso no esté disponible:

- Responder JSON consistente.
- Usar status 503 para conexión temporalmente no disponible.
- Usar status 500 para errores internos no recuperables.
- No devolver stack traces ni tokens.
- Registrar:
  - ruta
  - operación
  - tipo de error
  - request ID, si existe
- No registrar contenido financiero completo.

Mensajes de UI:

```
The database is temporarily unavailable. Please try again.
```

Para configuración faltante:

```
The production database is not configured.
```

## Fase 11 — Tests de regresión

Agregar tests para:

1. Migración sobre una base vacía.
2. Migraciones ejecutadas dos veces.
3. Crear y buscar compañía.
4. Evitar compañía duplicada.
5. Crear workspace.
6. Crear y editar cuenta.
7. Importar statement.
8. Detectar archivo duplicado.
9. Insertar transacciones y clasificaciones atómicamente.
10. Aprobar y excluir clasificaciones.
11. Registrar review events.
12. Generar reportes.
13. Registrar export.
14. Marcar workspace correctamente.
15. Error por credenciales ausentes en modo producción.

No mockear el cliente en todos los tests de integración. Al menos una suite debe ejecutar SQL real sobre libSQL local.

## Fase 12 — E2E en preview de Vercel

Ejecutar contra el preview desplegado:

1. Abrir la aplicación.
2. Crear una compañía única.
3. Crear workspace 2026.
4. Crear cuenta bancaria.
5. Recargar y recuperar la compañía.
6. Subir XLSX.
7. Importar transacciones.
8. Revisar una excepción.
9. Continuar a conciliación.
10. Abrir resultados.
11. Exportar Financial Statements.
12. Exportar Financial Statements + Transactions.
13. Verificar que las descargas sean XLSX válidos.
14. Abrir los archivos con ExcelJS.
15. Comprobar valores y nombres de hojas.
16. Abrir una segunda sesión y confirmar persistencia.

Revisar los runtime logs de Vercel y comprobar:

- No `SQLITE_READONLY`.
- No intentos de abrir `data/app.db`.
- No errores de credenciales.
- No 500 en APIs principales.
- No tokens en logs.

## Fuera de alcance

No implementar:

- Supabase.
- Neon/Postgres.
- Prisma.
- Drizzle.
- Autenticación.
- OCR.
- PDF.
- Vercel Blob.
- Edge Runtime.
- Embedded replicas.
- Sincronización offline.
- Reglas aprendidas.
- Rediseño del wizard.
- Migración de datos locales históricos, salvo que el usuario lo solicite expresamente.

## Definición de terminado

No declarar terminado hasta comprobar:

```bash
pnpm install
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm db:migrate
```

Todos deben terminar con exit code 0.

Además:

- `better-sqlite3` no aparece en `package.json` ni lockfile.
- No existen imports de `better-sqlite3`.
- Node está configurado como `24.x`.
- Una base libSQL local funciona sin internet.
- Turso contiene las tablas esperadas.
- El preview deployment queda en estado READY.
- El E2E remoto pasa.
- Los datos sobreviven nuevas invocaciones y deployments.
- No aparece `SQLITE_READONLY`.
- No hay credenciales en Git ni logs.

## Entrega final

Entregar:

1. Causa raíz confirmada.
2. Arquitectura anterior y nueva.
3. Dependencias agregadas y eliminadas.
4. Archivos modificados.
5. Migraciones aplicadas.
6. Variables requeridas.
7. Evidencia de tests locales.
8. URL del preview.
9. Evidencia del E2E remoto.
10. Revisión de runtime logs.
11. Limitaciones restantes.
12. Instrucciones de rollback.
