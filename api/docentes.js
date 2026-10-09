// Cuentas de docentes (función de Vercel).
// Crear usuarios necesita la clave "service_role" de Supabase, que solo vive
// aquí, en la variable SUPABASE_SERVICE_ROLE_KEY de Vercel. Solo un usuario
// con rol de administración puede usar esta función.
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../src/supabaseClient.js";

const SUPABASE_URL = supabase.supabaseUrl || "https://vmrihjkdlrftkxapajpy.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Inicia sesión." });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth?.user) return res.status(401).json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: "Falta configurar la variable SUPABASE_SERVICE_ROLE_KEY en Vercel." });
  }
  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Solo administración
  const { data: perfil, error: perfilError } = await admin.from("perfiles").select("rol").eq("user_id", auth.user.id).maybeSingle();
  if (perfilError) return res.status(500).json({ error: "Primero ejecuta el script de roles en Supabase (supabase/roles_docentes.sql)." });
  if (perfil?.rol !== "admin") return res.status(403).json({ error: "Solo administración puede manejar cuentas de docentes." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { accion, maestro_id } = body;
  if (!maestro_id) return res.status(400).json({ error: "Falta el maestro." });
  const { data: maestro } = await admin.from("maestros").select("id,nombre").eq("id", maestro_id).maybeSingle();
  if (!maestro) return res.status(404).json({ error: "No se encontró el maestro." });
  const { data: actual } = await admin.from("perfiles").select("user_id,email").eq("maestro_id", maestro_id).eq("rol", "docente").maybeSingle();

  try {
    if (accion === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Escribe un correo válido." });
      if (password.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
      if (actual) return res.status(400).json({ error: `${maestro.nombre} ya tiene acceso (${actual.email}).` });

      const { data: creado, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre: maestro.nombre, rol: "docente" },
      });
      if (error) {
        const yaExiste = /already|registered|exists/i.test(error.message);
        return res.status(400).json({ error: yaExiste ? "Ese correo ya tiene una cuenta en el sistema. Usa otro correo." : `No se pudo crear la cuenta: ${error.message}` });
      }
      const { error: e2 } = await admin.from("perfiles").insert({ user_id: creado.user.id, rol: "docente", maestro_id, email });
      if (e2) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return res.status(500).json({ error: `No se pudo guardar el rol: ${e2.message}` });
      }
      return res.status(200).json({ ok: true, email });
    }

    if (accion === "contrasena") {
      const password = String(body.password || "");
      if (!actual) return res.status(400).json({ error: "Este maestro todavía no tiene acceso." });
      if (password.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
      const { error } = await admin.auth.admin.updateUserById(actual.user_id, { password });
      if (error) return res.status(400).json({ error: `No se pudo cambiar: ${error.message}` });
      return res.status(200).json({ ok: true });
    }

    if (accion === "quitar") {
      if (!actual) return res.status(400).json({ error: "Este maestro no tiene acceso." });
      const { error } = await admin.auth.admin.deleteUser(actual.user_id);
      if (error) return res.status(400).json({ error: `No se pudo quitar: ${error.message}` });
      await admin.from("perfiles").delete().eq("user_id", actual.user_id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción no válida." });
  } catch (e) {
    return res.status(500).json({ error: `Error: ${e.message}` });
  }
}
