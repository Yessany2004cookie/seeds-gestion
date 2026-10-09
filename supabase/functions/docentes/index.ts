// Cuentas de docentes (Edge Function de Supabase).
// La clave service_role la pone Supabase automáticamente en el entorno de la
// función; nunca sale del servidor. Solo administración puede usarla.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder(405, { error: "Método no permitido" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quién llama, y que sea administración
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) return responder(401, { error: "Tu sesión expiró. Vuelve a iniciar sesión." });
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("user_id", auth.user.id).maybeSingle();
  if (perfil?.rol !== "admin") return responder(403, { error: "Solo administración puede manejar cuentas de docentes." });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const accion = String(body.accion || "");
  const maestro_id = String(body.maestro_id || "");
  if (!maestro_id) return responder(400, { error: "Falta el maestro." });

  const { data: maestro } = await admin.from("maestros").select("id,nombre").eq("id", maestro_id).maybeSingle();
  if (!maestro) return responder(404, { error: "No se encontró el maestro." });
  // Cuenta que ya tiene este maestro (de docente, o de administración vinculada)
  const { data: actual } = await admin.from("perfiles").select("user_id,email,rol").eq("maestro_id", maestro_id).maybeSingle();

  try {
    if (accion === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email)) return responder(400, { error: "Escribe un correo válido." });
      if (password.length < 8) return responder(400, { error: "La contraseña debe tener al menos 8 caracteres." });
      if (actual) return responder(400, { error: `${maestro.nombre} ya tiene acceso (${actual.email}).` });

      // Si el correo es de una cuenta de administración, se vincula (no se crea otra):
      // esa persona podrá cambiar a la vista docente desde su cuenta.
      const { data: existente } = await admin.from("perfiles").select("user_id,rol,maestro_id").eq("email", email).maybeSingle();
      if (existente) {
        if (existente.rol !== "admin") return responder(400, { error: "Ese correo ya es de otro docente. Usa otro correo." });
        if (existente.maestro_id) return responder(400, { error: "Esa cuenta de administración ya está vinculada a otro maestro." });
        const { error: eV } = await admin.from("perfiles").update({ maestro_id }).eq("user_id", existente.user_id);
        if (eV) return responder(500, { error: `No se pudo vincular: ${eV.message}` });
        return responder(200, { ok: true, email, vinculado: true });
      }

      const { data: creado, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre: maestro.nombre, rol: "docente" },
      });
      if (error || !creado?.user) {
        const yaExiste = /already|registered|exists/i.test(error?.message || "");
        return responder(400, { error: yaExiste ? "Ese correo ya tiene una cuenta en el sistema. Usa otro correo." : `No se pudo crear la cuenta: ${error?.message}` });
      }
      const { error: e2 } = await admin.from("perfiles").insert({ user_id: creado.user.id, rol: "docente", maestro_id, email });
      if (e2) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return responder(500, { error: `No se pudo guardar el rol: ${e2.message}` });
      }
      return responder(200, { ok: true, email });
    }

    if (accion === "contrasena") {
      const password = String(body.password || "");
      if (!actual) return responder(400, { error: "Este maestro todavía no tiene acceso." });
      if (actual.rol === "admin") return responder(400, { error: "Es una cuenta de administración: su contraseña no se cambia desde aquí." });
      if (password.length < 8) return responder(400, { error: "La contraseña debe tener al menos 8 caracteres." });
      const { error } = await admin.auth.admin.updateUserById(actual.user_id, { password });
      if (error) return responder(400, { error: `No se pudo cambiar: ${error.message}` });
      return responder(200, { ok: true });
    }

    if (accion === "quitar") {
      if (!actual) return responder(400, { error: "Este maestro no tiene acceso." });
      if (actual.rol === "admin") {
        // Cuenta de administración: solo se desvincula, la cuenta sigue igual
        const { error: eD } = await admin.from("perfiles").update({ maestro_id: null }).eq("user_id", actual.user_id);
        if (eD) return responder(400, { error: `No se pudo desvincular: ${eD.message}` });
        return responder(200, { ok: true, desvinculado: true });
      }
      const { error } = await admin.auth.admin.deleteUser(actual.user_id);
      if (error) return responder(400, { error: `No se pudo quitar: ${error.message}` });
      await admin.from("perfiles").delete().eq("user_id", actual.user_id);
      return responder(200, { ok: true });
    }

    return responder(400, { error: "Acción no válida." });
  } catch (e) {
    return responder(500, { error: `Error: ${(e as Error).message}` });
  }
});
