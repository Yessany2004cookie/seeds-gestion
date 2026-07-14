# 🌱 Seeds English School — Sistema de Gestión (versión nube)

Sistema completo con base de datos en la nube (Supabase). Los datos se comparten
entre todos los usuarios y tienen respaldo automático.

## 📋 Qué necesitas (todo gratis)

1. Una cuenta en **supabase.com** (base de datos)
2. Una cuenta en **github.com** (para guardar el código)
3. Una cuenta en **vercel.com** (para publicar la app en internet)

---

## PASO 1 — Crear la base de datos en Supabase

1. Entra a **https://supabase.com** → "Start your project" → crea cuenta
2. Clic en "New Project" → ponle un nombre (ej: seeds) → elige una contraseña
   segura para la base de datos → región "East US" → "Create new project"
3. Espera ~2 minutos a que se cree
4. En el menú lateral, clic en **SQL Editor** → "New query"
5. Abre el archivo **seeds_schema_v2.sql**, copia TODO su contenido, pégalo ahí
6. Clic en **Run** (o Ctrl+Enter). Debe decir "Success"

Con eso ya tienes todas las tablas creadas.

---

## PASO 2 — Obtener tus credenciales

1. En Supabase, menú lateral → **Settings** (engranaje) → **API**
2. Copia dos valores:
   - **Project URL** (ej: https://abcdef.supabase.co)
   - **anon public** (una clave larga que empieza con "eyJ...")
3. Abre el archivo **src/supabaseClient.js** en tu computadora
4. Reemplaza los dos valores de ejemplo con los tuyos:
   ```
   const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';   ← pega tu Project URL
   const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';             ← pega tu anon public
   ```
5. Guarda el archivo

---

## PASO 3 — Crear tu primer usuario (para entrar a la app)

1. En Supabase, menú lateral → **Authentication** → **Users**
2. Clic en "Add user" → "Create new user"
3. Pon tu correo y una contraseña → "Create user"
4. Esa será tu cuenta para entrar a la app.

Para agregar más gente (secretaria, maestros) repites este paso con sus correos.

---

## PASO 4 — Probar en tu computadora

1. Instala Node.js desde https://nodejs.org (si no lo tienes)
2. Abre la carpeta del proyecto en la terminal
3. Ejecuta:
   ```
   npm install
   npm run dev
   ```
4. Abre http://localhost:5173 → entra con el correo y contraseña del Paso 3

---

## PASO 5 — Publicar en internet (Vercel)

1. Sube el proyecto a GitHub:
   ```
   git init
   git add .
   git commit -m "Seeds English School"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/seeds-gestion.git
   git push -u origin main
   ```
2. Entra a **https://vercel.com** → inicia sesión con GitHub
3. "Add New" → "Project" → selecciona tu repositorio → "Deploy"
4. En ~2 minutos te da una URL pública (ej: seeds-gestion.vercel.app)
5. Comparte esa URL con quien va a usar la app. Todos entran con sus correos.

---

## 🔧 Cómo modificar el código

- **Todo el código está en `src/App.jsx`** — es un solo archivo
- El monto de la mora está al inicio: `const MORA_MENSUAL = 50;`
- Los colores, textos y lógica están todos ahí, comentados por secciones
- Cuando cambies algo y hagas `git push`, Vercel actualiza la app sola

---

## 💾 Sobre la seguridad de tus datos

- Los datos viven en Supabase (servidores profesionales), NO en el navegador
- Todos los usuarios ven los mismos datos en tiempo real
- Supabase hace respaldos automáticos
- Además, en la pestaña "Sistema" de la app puedes descargar un respaldo manual
- ⚠️ Plan gratuito: si nadie usa la app por 7 días, el proyecto se "pausa" (los
  datos NO se pierden). Se reactiva desde supabase.com con un clic.

---

## ❓ Problemas comunes

- **"Invalid API key"** → revisa que copiaste bien las credenciales en supabaseClient.js
- **No puedo entrar** → verifica que creaste el usuario en Authentication (Paso 3)
- **La app está vacía** → normal al inicio, agrega secciones y alumnos
- **Proyecto pausado** → entra a supabase.com → tu proyecto → botón "Restore"
