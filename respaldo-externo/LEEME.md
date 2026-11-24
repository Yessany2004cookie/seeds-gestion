# Copia mensual fuera de Supabase

Además de la copia que Supabase guarda adentro (ver `supabase/respaldos_automaticos.sql`),
el día 1 de cada mes se guarda una copia en un **repositorio privado de GitHub**. Así, si
Supabase fallara o el proyecto se perdiera, los datos siguen en otro lugar.

> ⚠️ Nunca en `seeds-gestion`: ese repositorio es público y la copia tiene datos de alumnos y padres.

## Configurarlo (una sola vez, ~5 minutos)

1. **Crear el repositorio privado**
   En GitHub → botón **+** → **New repository**. Nombre: `seeds-respaldos`.
   Marcar **Private** y **Add a README file**. → **Create repository**.

2. **Copiar la clave secreta de Supabase**
   supabase.com → el proyecto → **Project Settings** → **API Keys** →
   copiar la clave **service_role** (o la *secret key*, empieza con `sb_secret_`).
   Esta clave es como la llave maestra: no la pegues en ningún otro lado.

3. **Guardarla como secreto en el repositorio privado**
   En `seeds-respaldos` → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret**. Nombre: `SUPABASE_SERVICE_KEY`. Valor: la clave del paso 2.

4. **Agregar el archivo de la tarea mensual**
   En `seeds-respaldos` → **Add file** → **Create new file**. Nombre:
   `.github/workflows/respaldo-mensual.yml`. Pegar el contenido de
   [`respaldo-mensual.yml`](respaldo-mensual.yml) → **Commit changes**.

5. **Probarlo**
   En `seeds-respaldos` → **Actions** → **Respaldo mensual** → **Run workflow**.
   Al terminar aparece un archivo nuevo en la carpeta `respaldos/`.

Desde ahí se repite solo el día 1 de cada mes.

## Restaurar desde esa copia

- **Si Supabase sigue funcionando:** descarga el archivo `.json` del repositorio privado y en la
  app usa **Sistema y respaldos → Restaurar respaldo**.
- **Si hubiera que empezar en un proyecto de Supabase nuevo:** crear el proyecto, correr en el
  SQL Editor `seeds_schema_v2.sql` y los archivos de `supabase/` (esto crea las tablas vacías),
  cambiar la URL y la clave en `src/supabaseClient.js`, y luego cargar el `.json` con
  **Restaurar respaldo**.
