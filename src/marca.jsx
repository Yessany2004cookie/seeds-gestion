// ── PLANTILLA PERSONALIZABLE (nombre, logo y nombres de pestañas) ──
// Administración puede cambiar el nombre de la institución, el subtítulo, el
// logo y el nombre de cada pestaña del menú, tocando el lápiz ✏️ como cuando
// se edita un perfil en una red social. Se guarda en la tabla marca_sistema.
//
// Ocultar una pestaña o apagar un módulo pide la CLAVE DE SEGURIDAD
// (la revisa la base de datos, ver supabase/marca_sistema.sql). Encender o
// volver a mostrar no la pide. Ocultar NO borra datos.
//
// Si la tabla aún no existe, todo se ve como siempre (Seeds).
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { card, input, btn, btnO, label, AZUL, NARANJA } from "./estilo";
import { LOGO_SEEDS } from "./logo";

// Pestañas que no se pueden ocultar (Inicio, cobro a padres y la configuración)
export const PESTANAS_FIJAS = ["dashboard", "facturas", "config", "sistema"];

const VACIA = { nombre: null, subtitulo: null, logo: null, etiquetas: {}, ocultas: [] };
let marca = VACIA;
let cargada = false;
let cargando = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(marca));

const cargar = () => {
  if (cargando) return cargando;
  cargando = (async () => {
    const { data, error } = await supabase.from("marca_sistema").select("nombre,subtitulo,logo,etiquetas,ocultas").eq("id", 1).maybeSingle();
    marca = !error && data ? { ...VACIA, ...data, etiquetas: data.etiquetas || {}, ocultas: data.ocultas || [] } : VACIA;
    cargada = true;
    cargando = null;
    avisar();
  })();
  return cargando;
};

const faltaSQL = (msg) => /relation|does not exist|schema cache|Could not find the function|permission denied/i.test(msg || "");
const AVISO_SQL = "Falta activar la personalización en Supabase (supabase/marca_sistema.sql)";

// Devuelve la marca y ayudantes: nombre(defecto), etiqueta(clave, defecto), oculta(id)
export function useMarca() {
  const [m, setM] = useState(marca);
  useEffect(() => {
    const f = (x) => setM(x);
    oyentes.add(f);
    if (!cargada) cargar(); else setM(marca);
    return () => oyentes.delete(f);
  }, []);
  return {
    ...m,
    logoSrc: m.logo || LOGO_SEEDS,
    nombreO: (defecto) => (m.nombre && m.nombre.trim()) || defecto,
    subtituloO: (defecto) => (m.subtitulo && m.subtitulo.trim()) || defecto,
    etiqueta: (clave, defecto) => (m.etiquetas?.[clave] && String(m.etiquetas[clave]).trim()) || defecto,
    oculta: (id) => (m.ocultas || []).includes(id),
    recargar: cargar,
  };
}

// Guarda nombre, subtítulo, logo o etiquetas (no pide clave)
export async function guardarMarca(cambios, showToast, textoOk = "Cambios guardados") {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("marca_sistema")
    .update({ ...cambios, actualizado: new Date().toISOString(), actualizado_por: user?.id || null })
    .eq("id", 1).select("id").single();
  if (error) { showToast(faltaSQL(error.message) ? AVISO_SQL : "No se pudo guardar: " + error.message, "error"); return false; }
  marca = { ...marca, ...cambios }; avisar();
  showToast(textoOk);
  return true;
}

export const guardarEtiqueta = (clave, texto, showToast) => {
  const etiquetas = { ...(marca.etiquetas || {}) };
  if (texto && texto.trim()) etiquetas[clave] = texto.trim(); else delete etiquetas[clave];
  return guardarMarca({ etiquetas }, showToast, "Nombre actualizado");
};

// Llama a una función de la base de datos que devuelve null si salió bien o el motivo si no
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) return faltaSQL(error.message) ? AVISO_SQL : error.message;
  return data || null;
}

export async function cambiarOcultas(nuevas, clave) {
  const motivo = await rpc("cambiar_pestanas_ocultas", { p_ocultas: nuevas, p_clave: clave || null });
  if (!motivo) { marca = { ...marca, ocultas: nuevas }; avisar(); }
  return motivo;
}
export const mostrarPestana = (id) => cambiarOcultas((marca.ocultas || []).filter((x) => x !== id), null);
export const ocultarPestana = (id, clave) => cambiarOcultas([...new Set([...(marca.ocultas || []), id])], clave);

export const cambiarModulosConClave = (apagados, clave) => rpc("cambiar_modulos", { p_apagados: apagados, p_clave: clave || null });

// ── Logo: se achica a 320 px para que cargue rápido ──
const leerImagen = (file) => new Promise((ok, mal) => {
  if (!file || !file.type.startsWith("image/")) { mal(new Error("Elija una imagen (JPG o PNG)")); return; }
  const lector = new FileReader();
  lector.onload = () => {
    const img = new Image();
    img.onload = () => {
      const lado = 320, k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let url = c.toDataURL("image/png");
      if (url.length > 350000) url = c.toDataURL("image/jpeg", 0.88);
      ok(url);
    };
    img.onerror = () => mal(new Error("No se pudo leer la imagen"));
    img.src = lector.result;
  };
  lector.onerror = () => mal(new Error("No se pudo leer el archivo"));
  lector.readAsDataURL(file);
});

// ── Texto que se edita en su lugar (tocar el lápiz → escribir → Enter) ──
export function TextoEditable({ valor, onGuardar, editando, estilo, oscuro, max = 60, titulo = "Cambiar nombre" }) {
  const [abierto, setAbierto] = useState(false);
  const [txt, setTxt] = useState(valor);
  const ref = useRef(null);
  useEffect(() => { if (abierto) { setTxt(valor); setTimeout(() => ref.current?.select(), 0); } }, [abierto]);
  if (!editando) return <span style={estilo}>{valor}</span>;
  const guardar = async () => { if (txt.trim() === valor) { setAbierto(false); return; } if (await onGuardar(txt)) setAbierto(false); };
  if (abierto) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "100%" }} onClick={(e) => e.stopPropagation()}>
      <input ref={ref} value={txt} maxLength={max} onChange={(e) => setTxt(e.target.value)} aria-label={titulo}
        onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setAbierto(false); }}
        style={{ ...input, padding: "4px 6px", fontSize: 13, flex: 1, minWidth: 0, color: AZUL }} />
      <button onClick={guardar} title="Guardar" aria-label="Guardar" style={miniBtn("#2F6B4F")}>✓</button>
      <button onClick={() => setAbierto(false)} title="Cancelar" aria-label="Cancelar" style={miniBtn("#8A94A6")}>✕</button>
    </span>
  );
  return (
    <span onClick={(e) => { e.stopPropagation(); setAbierto(true); }} title={titulo} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setAbierto(true)}
      style={{ ...estilo, cursor: "text", display: "inline-flex", alignItems: "center", gap: 6, borderBottom: `1px dashed ${oscuro ? "rgba(255,255,255,.45)" : "#B8C2D3"}` }}>
      {valor}<span aria-hidden style={{ fontSize: 11, opacity: .85 }}>✏️</span>
    </span>
  );
}
const miniBtn = (c) => ({ width: 24, height: 24, flexShrink: 0, border: "none", borderRadius: 3, background: c, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 });

// ── Logo con botón de cámara para cambiarlo, con vista previa ──
export function LogoEditable({ src, editando, tam = 96, showToast }) {
  const archivo = useRef(null);
  const [previa, setPrevia] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const elegir = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { setPrevia(await leerImagen(f)); } catch (x) { showToast(x.message, "error"); }
  };
  const usar = async () => { setGuardando(true); const ok = await guardarMarca({ logo: previa }, showToast, "Logo actualizado"); setGuardando(false); if (ok) setPrevia(null); };
  return (
    <>
      <div style={{ position: "relative", background: "#fff", borderRadius: 4, padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={src} alt="Logo" style={{ width: tam, height: tam, objectFit: "contain" }} />
        {editando && <button onClick={() => archivo.current?.click()} title="Cambiar logo" aria-label="Cambiar logo"
          style={{ position: "absolute", inset: 0, border: "none", borderRadius: 4, background: "rgba(15,23,42,.55)", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          <span style={{ fontSize: 22 }}>📷</span>Cambiar logo
        </button>}
        <input ref={archivo} type="file" accept="image/*" onChange={elegir} style={{ display: "none" }} />
      </div>
      {previa && <Ventana titulo="¿Usar este logo?" onCerrar={() => setPrevia(null)}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", margin: "6px 0 16px" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: "#8A94A6", marginBottom: 6 }}>Antes</div><img src={src} alt="Logo actual" style={{ width: 90, height: 90, objectFit: "contain", border: "1px solid #DCE1E8", borderRadius: 4, padding: 4, opacity: .6 }} /></div>
          <span style={{ fontSize: 20, color: "#8A94A6" }}>→</span>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: NARANJA, marginBottom: 6, fontWeight: 600 }}>Nuevo</div><img src={previa} alt="Logo nuevo" style={{ width: 120, height: 120, objectFit: "contain", border: `2px solid ${NARANJA}`, borderRadius: 4, padding: 4 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={() => archivo.current?.click()} style={btnO}>Elegir otra</button>
          <button onClick={usar} disabled={guardando} style={{ ...btn(), opacity: guardando ? .7 : 1 }}>{guardando ? "Guardando…" : "Usar este logo"}</button>
        </div>
      </Ventana>}
    </>
  );
}

// ── Ventana simple ──
export function Ventana({ titulo, children, onCerrar, ancho = 420 }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && onCerrar(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onCerrar]);
  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()} style={{ ...card, marginBottom: 0, width: "100%", maxWidth: ancho, maxHeight: "90vh", overflowY: "auto", color: "#1F2937" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: AZUL, margin: 0 }}>{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#8A94A6" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Confirmación con clave de seguridad ──
// accion(clave) debe devolver null si salió bien, o el motivo del error.
export function ConfirmarConClave({ titulo, que, consecuencia, textoBoton = "Confirmar", accion, onCerrar, onListo }) {
  const [entiendo, setEntiendo] = useState(false);
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ir = async () => {
    if (!entiendo || !clave || busy) return;
    setBusy(true); setError("");
    const motivo = await accion(clave);
    setBusy(false);
    if (motivo) { setError(motivo); setClave(""); return; }
    onListo?.(); onCerrar();
  };
  return (
    <Ventana titulo={titulo} onCerrar={onCerrar}>
      <div style={{ background: "#FBF1EA", border: "1px solid #E7B48F", borderRadius: 4, padding: 12, fontSize: 13, color: "#7A3E14", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🔒 Acción protegida: {que}</div>
        <div>{consecuencia}</div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#3F4A5A", marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} style={{ marginTop: 2 }} />
        <span>Entiendo lo que va a pasar y estoy autorizada/o para hacerlo.</span>
      </label>
      <label style={label}>Clave de seguridad</label>
      <input type="password" value={clave} autoFocus onChange={(e) => setClave(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ir()}
        placeholder="Escriba la clave de seguridad" autoComplete="off" style={input} />
      {error && <div role="alert" style={{ marginTop: 10, padding: "8px 10px", background: "#FBEAEA", color: "#8E3131", borderRadius: 4, fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onCerrar} style={btnO}>Cancelar</button>
        <button onClick={ir} disabled={!entiendo || !clave || busy} style={{ ...btn("#A33A3A"), opacity: !entiendo || !clave || busy ? .5 : 1, cursor: !entiendo || !clave || busy ? "default" : "pointer" }}>{busy ? "Revisando…" : textoBoton}</button>
      </div>
    </Ventana>
  );
}

// ── Panel: Clave de seguridad (en Sistema y respaldos) ──
export function ClaveSeguridadPanel({ showToast }) {
  const [estado, setEstado] = useState(null); // null cargando | {existe} | {falta:true}
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ actual: "", nueva: "", repetir: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const leer = async () => {
    const { data, error } = await supabase.rpc("estado_clave_seguridad");
    setEstado(error ? { falta: true } : data || { existe: false });
  };
  useEffect(() => { leer(); }, []);
  const guardar = async () => {
    setError("");
    if (f.nueva.length < 4) { setError("La clave nueva debe tener al menos 4 caracteres."); return; }
    if (f.nueva !== f.repetir) { setError("Las dos claves nuevas no son iguales."); return; }
    setBusy(true);
    const motivo = await rpc("fijar_clave_seguridad", { p_actual: f.actual || null, p_nueva: f.nueva });
    setBusy(false);
    if (motivo) { setError(motivo); return; }
    showToast(estado?.existe ? "Clave de seguridad cambiada" : "Clave de seguridad creada");
    setAbierto(false); setF({ actual: "", nueva: "", repetir: "" }); leer();
  };
  return (
    <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: AZUL, margin: "0 0 6px" }}>🔒 Clave de seguridad</h3>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>Se pide para <strong>apagar un módulo</strong> u <strong>ocultar una pestaña</strong>, para que nadie lo haga por error o sin permiso. Es distinta a la contraseña para entrar. Guárdela en un lugar seguro: después de 5 intentos incorrectos se bloquea 10 minutos.</p>
      {estado === null ? <div style={{ fontSize: 13, color: "#94A3B8" }}>Cargando…</div>
        : estado.falta ? <div style={{ fontSize: 13, color: "#8E3131" }}>{AVISO_SQL}</div>
        : <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: estado.existe ? "#2F6B4F" : "#A8701E" }}>{estado.existe ? "✓ Clave activa" : "⚠️ Todavía no hay clave"}</span>
            <button onClick={() => { setAbierto(true); setError(""); }} style={estado.existe ? btnO : btn()}>{estado.existe ? "Cambiar clave" : "Crear clave"}</button>
          </div>}
      {abierto && <Ventana titulo={estado?.existe ? "Cambiar clave de seguridad" : "Crear clave de seguridad"} onCerrar={() => setAbierto(false)}>
        {estado?.existe && <div style={{ marginBottom: 12 }}><label style={label}>Clave actual</label><input type="password" autoComplete="off" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} style={input} /></div>}
        <div style={{ marginBottom: 12 }}><label style={label}>Clave nueva (mínimo 4 caracteres)</label><input type="password" autoComplete="new-password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} style={input} /></div>
        <div><label style={label}>Repita la clave nueva</label><input type="password" autoComplete="new-password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} onKeyDown={(e) => e.key === "Enter" && guardar()} style={input} /></div>
        {error && <div role="alert" style={{ marginTop: 10, padding: "8px 10px", background: "#FBEAEA", color: "#8E3131", borderRadius: 4, fontSize: 12.5 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={() => setAbierto(false)} style={btnO}>Cancelar</button>
          <button onClick={guardar} disabled={busy} style={{ ...btn(), opacity: busy ? .7 : 1 }}>{busy ? "Guardando…" : "Guardar clave"}</button>
        </div>
      </Ventana>}
    </div>
  );
}

// ── Panel: Personalizar la plantilla (en Sistema y respaldos) ──
// pestanas: [{id, label, labelOriginal, grupo}] del menú de administración
// pestanasDocente: [{id, label}] del portal docente
export function PersonalizarPanel({ showToast, onEditarMenu, pestanas, grupos, pestanasDocente }) {
  const m = useMarca();
  const [ocultar, setOcultar] = useState(null);
  const [restablecer, setRestablecer] = useState(false);
  const fila = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #F1F5F9", fontSize: 13 };
  const ocultasLista = pestanas.filter((p) => m.oculta(p.id));
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: AZUL, margin: "0 0 6px" }}>🎨 Personalizar el sistema</h3>
          <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Cambie el logo, el nombre de la institución y el nombre de cada pestaña. Toque el lápiz ✏️, escriba y presione Enter. También puede hacerlo directo en el menú con el botón <strong>Personalizar</strong>.</p>
        </div>
        <button onClick={onEditarMenu} style={btn()}>✏️ Editar en el menú</button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "12px 0", borderTop: "1px solid #F1F5F9" }}>
        <LogoEditable src={m.logoSrc} editando tam={84} showToast={showToast} />
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
          <div><div style={{ fontSize: 11, color: "#8A94A6", marginBottom: 2 }}>Nombre de la institución</div>
            <TextoEditable editando valor={m.nombreO("Seeds English")} max={50} onGuardar={(t) => guardarMarca({ nombre: t.trim() || null }, showToast, "Nombre actualizado")} estilo={{ fontSize: 17, fontWeight: 700, color: AZUL }} /></div>
          <div><div style={{ fontSize: 11, color: "#8A94A6", marginBottom: 2 }}>Subtítulo</div>
            <TextoEditable editando valor={m.subtituloO("Sistema de Gestión")} max={40} onGuardar={(t) => guardarMarca({ subtitulo: t.trim() || null }, showToast, "Subtítulo actualizado")} estilo={{ fontSize: 13, color: NARANJA, fontWeight: 600 }} /></div>
        </div>
      </div>

      <details style={{ borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: AZUL }}>Nombres de las pestañas del menú</summary>
        {grupos.map((g) => (
          <div key={g.id} style={{ marginTop: 10 }}>
            <div style={{ ...fila, borderTop: "none", fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, letterSpacing: .5, color: "#5B6576" }}>
              <TextoEditable editando valor={g.label} max={30} onGuardar={(t) => guardarEtiqueta("g:" + g.id, t, showToast)} estilo={{ color: "#5B6576" }} />
            </div>
            {pestanas.filter((p) => p.grupoId === g.id).map((p) => (
              <div key={p.id} style={{ ...fila, paddingLeft: 14, opacity: m.oculta(p.id) ? .5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TextoEditable editando valor={p.label} max={40} onGuardar={(t) => guardarEtiqueta("n:" + p.id, t, showToast)} estilo={{ color: "#1F2937" }} />
                  {p.label !== p.labelOriginal && <span style={{ fontSize: 11, color: "#8A94A6", marginLeft: 6 }}>(antes: {p.labelOriginal})</span>}
                </div>
                {PESTANAS_FIJAS.includes(p.id) ? <span style={{ fontSize: 11, color: "#8A94A6" }}>Siempre visible</span>
                  : m.oculta(p.id) ? <button onClick={async () => { const e = await mostrarPestana(p.id); showToast(e || `${p.label}: visible otra vez`, e ? "error" : "success"); }} style={{ ...btnO, padding: "4px 10px", fontSize: 12 }}>Mostrar</button>
                  : <button onClick={() => setOcultar(p)} style={{ ...btnO, padding: "4px 10px", fontSize: 12, color: "#8E3131" }}>🔒 Ocultar</button>}
              </div>
            ))}
          </div>
        ))}
        {pestanasDocente?.length > 0 && <div style={{ marginTop: 14 }}>
          <div style={{ ...fila, borderTop: "none", fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, letterSpacing: .5, color: "#5B6576" }}>Portal docente</div>
          {pestanasDocente.map((p) => (
            <div key={p.id} style={{ ...fila, paddingLeft: 14 }}>
              <TextoEditable editando valor={m.etiqueta("d:" + p.id, p.label)} max={40} onGuardar={(t) => guardarEtiqueta("d:" + p.id, t, showToast)} estilo={{ color: "#1F2937" }} />
            </div>
          ))}
        </div>}
      </details>

      {ocultasLista.length > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: "#5B6576" }}>Pestañas ocultas: {ocultasLista.map((p) => p.label).join(", ")}. Puede volver a mostrarlas arriba (no pide clave).</div>}

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setRestablecer(true)} style={{ ...btnO, fontSize: 12 }}>Volver al diseño original</button>
      </div>

      {ocultar && <ConfirmarConClave titulo={`Ocultar «${ocultar.label}»`} que="ocultar una pestaña"
        consecuencia={<>La pestaña <strong>{ocultar.label}</strong> dejará de verse en el menú para todos. <strong>No se borra ningún dato</strong>: puede volver a mostrarla aquí cuando quiera.</>}
        textoBoton="Ocultar pestaña" accion={(c) => ocultarPestana(ocultar.id, c)} onCerrar={() => setOcultar(null)} onListo={() => showToast(`${ocultar.label}: oculta`)} />}
      {restablecer && <Ventana titulo="¿Volver al diseño original?" onCerrar={() => setRestablecer(false)}>
        <p style={{ fontSize: 13, color: "#475569", margin: "0 0 16px" }}>Se usarán otra vez el logo, el nombre y los nombres de pestañas originales. Las pestañas ocultas siguen como están.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setRestablecer(false)} style={btnO}>Cancelar</button>
          <button onClick={async () => { if (await guardarMarca({ nombre: null, subtitulo: null, logo: null, etiquetas: {} }, showToast, "Diseño original restablecido")) setRestablecer(false); }} style={btn()}>Restablecer</button>
        </div>
      </Ventana>}
    </div>
  );
}
