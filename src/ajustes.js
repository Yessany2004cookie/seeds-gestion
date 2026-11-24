// ════════════════════════════════════════════════════════════
//  AJUSTES GUARDADOS EN LA BASE DE DATOS
//  Valores que escribe administración (gastos fijos, margen mínimo,
//  texto del recordatorio, alertas ignoradas…) se guardan en Supabase,
//  no solo en este navegador. Así no se pierden al cambiar de
//  computadora o celular, al borrar el historial, y salen en los respaldos.
//
//  En el navegador queda una copia (localStorage "seeds_<clave>") solo para
//  mostrar el valor al instante mientras carga la base de datos.
//  Tablas: ajustes_sistema y alertas_ignoradas (supabase/seguridad_persistencia.sql).
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const claveLocal = (clave) => `seeds_${clave}`;
const convertir = (v, def) => (typeof def === "number" ? (Number.isFinite(Number(v)) ? Number(v) : def) : v);

function leerLocal(clave, def) {
  try { const v = localStorage.getItem(claveLocal(clave)); return v === null ? def : convertir(v, def); } catch (e) { return def; }
}
function guardarLocal(clave, v) {
  try { localStorage.setItem(claveLocal(clave), String(v)); } catch (e) { /* sin almacenamiento */ }
}

async function guardarEnBD(clave, valor) {
  const { error } = await supabase.from("ajustes_sistema").upsert({ clave, valor, actualizado: new Date().toISOString() });
  return error;
}

// [valor, cambiar] — se lee de la base de datos; si allí no hay nada pero este
// navegador tenía un valor guardado de antes, ese valor se sube (no se pierde).
export function useAjuste(clave, def) {
  const [valor, setValor] = useState(() => leerLocal(clave, def));
  const espera = useRef(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.from("ajustes_sistema").select("valor").eq("clave", clave).maybeSingle();
      if (!vivo || error) return; // tabla aún no creada o sin permiso: queda el valor local
      if (data) { const v = convertir(data.valor, def); setValor(v); guardarLocal(clave, v); }
      else {
        let local = null;
        try { local = localStorage.getItem(claveLocal(clave)); } catch (e) { local = null; }
        if (local !== null) guardarEnBD(clave, convertir(local, def));
      }
    })();
    return () => { vivo = false; };
  }, [clave]); // eslint-disable-line
  const cambiar = (v) => {
    setValor(v);
    guardarLocal(clave, v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => { guardarEnBD(clave, v); }, 700); // espera a que termine de escribir
  };
  return [valor, cambiar];
}

// ── Alertas de inactividad que administración decidió ignorar por un tiempo ──
// Devuelve { alumno_id: hasta_en_ms }. Junta lo de la base de datos con lo que
// este navegador tenía guardado de antes (y lo sube).
const LOCAL_IGNORADOS = "seeds_inactividad_ignorados";
export async function cargarIgnorados() {
  let local = {};
  try { local = JSON.parse(localStorage.getItem(LOCAL_IGNORADOS)) || {}; } catch (e) { local = {}; }
  const { data, error } = await supabase.from("alertas_ignoradas").select("alumno_id,hasta").eq("tipo", "inactividad");
  if (error) return local;
  const bd = Object.fromEntries((data || []).map((r) => [r.alumno_id, new Date(r.hasta).getTime()]));
  const subir = Object.entries(local).filter(([id, ms]) => ms > Date.now() && !(bd[id] >= ms));
  if (subir.length) {
    await supabase.from("alertas_ignoradas").upsert(subir.map(([alumno_id, ms]) => ({ tipo: "inactividad", alumno_id, hasta: new Date(ms).toISOString() })));
    subir.forEach(([id, ms]) => { bd[id] = ms; });
  }
  try { localStorage.setItem(LOCAL_IGNORADOS, JSON.stringify(bd)); } catch (e) { /* sin almacenamiento */ }
  return bd;
}
export async function ignorarAlerta(alumno_id, hastaMs) {
  try {
    const n = { ...(JSON.parse(localStorage.getItem(LOCAL_IGNORADOS)) || {}), [alumno_id]: hastaMs };
    localStorage.setItem(LOCAL_IGNORADOS, JSON.stringify(n));
  } catch (e) { /* sin almacenamiento */ }
  const { error } = await supabase.from("alertas_ignoradas").upsert({ tipo: "inactividad", alumno_id, hasta: new Date(hastaMs).toISOString() });
  return error;
}

// ── Historial de recordatorios enviados a padres (WhatsApp / correo) ──
export async function registrarRecordatorios(filas) {
  if (!filas.length) return null;
  const { error } = await supabase.from("recordatorios_enviados").insert(filas);
  return error;
}
// Último recordatorio de cada alumno para un mes: { alumno_id: {fecha, canal} }
export async function ultimosRecordatorios(mes, anio) {
  const { data, error } = await supabase.from("recordatorios_enviados").select("alumno_id,canal,enviado_en")
    .eq("mes", mes).eq("anio", anio).order("enviado_en", { ascending: false }).limit(2000);
  if (error) return {};
  const m = {};
  (data || []).forEach((r) => { if (!m[r.alumno_id]) m[r.alumno_id] = { fecha: r.enviado_en, canal: r.canal }; });
  return m;
}
