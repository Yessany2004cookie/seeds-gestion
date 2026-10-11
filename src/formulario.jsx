// ════════════════════════════════════════════════════════════
//  CHECK LIST DE LA CLASE (formulario editable)
//  - Administración edita las preguntas (tabla "formularios").
//  - El docente lo llena al terminar cada clase (tabla "reportes_clase").
//  - Cada envío guarda una copia de las preguntas ("campos"), así que editar
//    el formulario no cambia los reportes que ya llegaron.
//  - Administración los ve en una bandeja, por llegada o por maestro.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { Send, Plus, Trash2, Save, ChevronUp, ChevronDown, Copy, Eye, Inbox, Pencil, ArrowLeft, Mail, MailOpen, Check, Printer } from "lucide-react";

const NAR = "#EA580C";
const card = { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20, marginBottom: 16 };
const input = { width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };
const btn = (c = NAR) => ({ padding: "9px 18px", background: c, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 });
const btnO = { padding: "8px 14px", background: "#fff", color: "#64748B", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 };
const label = { fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoyISO = () => new Date().toLocaleDateString("en-CA");
const fechaLarga = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-HN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "");
const hace = (iso) => {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d < 7) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  return new Date(iso).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};
const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const COLORES_AVATAR = ["#EA580C", "#0EA5E9", "#8B5CF6", "#10B981", "#E11D48", "#F59E0B", "#6366F1", "#14B8A6"];
const colorDe = (id) => COLORES_AVATAR[[...String(id || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES_AVATAR.length];
const errorTexto = (e) => /relation|does not exist|schema cache|column/i.test(e?.message || "") ? "Falta activar el formulario editable en Supabase (script supabase/formularios.sql)." : e?.message || "Error";

export const TIPOS = [
  { v: "seccion", l: "Título de sección", i: "🔖" },
  { v: "texto", l: "Respuesta corta", i: "✏️" },
  { v: "parrafo", l: "Párrafo", i: "📝" },
  { v: "unica", l: "Opción única", i: "🔘" },
  { v: "varias", l: "Check list (varias)", i: "✅" },
  { v: "sino", l: "Sí / No", i: "👍" },
  { v: "escala", l: "Escala 1 a 5", i: "⭐" },
  { v: "numero", l: "Número", i: "🔢" },
  { v: "fecha", l: "Fecha", i: "📅" },
  { v: "mensaje", l: "Texto informativo", i: "💡" },
  { v: "firma", l: "Declaración y firma", i: "✍️" },
];
const ICONOS = ["💻", "📷", "🙏", "🏰", "🎬", "📞", "💰", "🤖", "✍️", "📚", "✏️", "🎯", "🧩", "🗣️", "🎧", "📖", "🏆", "💡", "⭐", "✅", "🎨", "🎵", "🧠", "👥", "⏰", "📝", "💬", "🌱", "🚀", "📊", "🔤", "🙋", "⚠️", "🏠", "🎲", "🖍️", "📷"];
const CARAS = ["😞", "😕", "😐", "🙂", "🤩"];

// Preguntas del reporte de clase anterior (para leer reportes viejos)
const CAMPOS_ANTERIORES = [
  { id: "tema", tipo: "texto", etiqueta: "Tema / unidad trabajada", icono: "📚" },
  { id: "objetivo", tipo: "parrafo", etiqueta: "Objetivo de la clase", icono: "🎯" },
  { id: "actividades", tipo: "parrafo", etiqueta: "Actividades realizadas", icono: "🧩" },
  { id: "tarea", tipo: "parrafo", etiqueta: "Tarea asignada", icono: "🏠" },
  { id: "materiales", tipo: "texto", etiqueta: "Materiales o recursos usados", icono: "🖍️" },
  { id: "logro", tipo: "unica", etiqueta: "¿Se cumplió el objetivo?", icono: "🏆", opciones: ["Sí", "Parcialmente", "No"] },
  { id: "destacados", tipo: "texto", etiqueta: "Alumnos que destacaron", icono: "⭐" },
  { id: "dificultades", tipo: "texto", etiqueta: "Alumnos con dificultades", icono: "🙋" },
  { id: "observaciones", tipo: "parrafo", etiqueta: "Observaciones generales", icono: "💬" },
];

// Formulario inicial: el "Checklist for teachers" de Jotform.
// La fecha, el docente y el grupo los pone el sistema.
const si = (id, icono, etiqueta) => ({ id, tipo: "sino", etiqueta, icono, req: true });
export const FORM_DEFECTO = {
  id: "reporte_clase",
  titulo: "Checklist for teachers",
  descripcion: "",
  despedida: "Thanks for being part of Seeds English School. Thanks for your responsibility.",
  campos: [
    { id: "porque", tipo: "mensaje", icono: "💡", etiqueta: "Why is this checklist important?", ayuda: "Because it helps us remember our activities in the class." },
    si("zoom", "💻", "I've already connected Zoom or Meet?"),
    si("foto", "📷", "I've already sent a photo to the group?"),
    si("ebook", "📖", "I've already used the e-book of Big English?"),
    si("biblia", "🙏", "I've already read the Bible text in English?"),
    si("disney_reader", "🏰", "I've already used Disney Reader?"),
    si("asistencia", "✅", "I've already taken attendance?"),
    si("disney_plus", "🎬", "I've already watched Disney Plus 10-15 minutes with English subtitles?"),
    si("padres", "📞", "I've already contacted the parents of absent students?"),
    si("plataforma", "🖥️", "I've already worked on the digital platform?"),
    si("cancion", "🎵", "I've already learned and practiced an English song (10 minutes)?"),
    si("finanzas", "💰", "I've already played the video about financial education?"),
    si("ia_pearson", "🤖", "Revisar avance en IA bot y plataforma Pearson"),
    { id: "firma", tipo: "firma", icono: "✍️", etiqueta: "I'm a Seeds English School teacher, my name is {nombre}. And I've done all activities with the students today.", req: true },
  ],
};

export function useFormulario() {
  const [form, setForm] = useState(null);
  const [activo, setActivo] = useState(true);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("formularios").select("*").eq("id", FORM_DEFECTO.id).maybeSingle();
    if (error) { setActivo(false); setForm(FORM_DEFECTO); return; }
    setActivo(true);
    setForm(data && Array.isArray(data.campos) && data.campos.length ? data : FORM_DEFECTO);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { form, activo, recargar: cargar };
}

const preguntas = (campos) => (campos || []).filter((c) => !["seccion", "mensaje"].includes(c.tipo));
const vacio = (c, v) => (c.tipo === "varias" ? !(Array.isArray(v) && v.length) : v === undefined || v === null || String(v).trim() === "");
const camposDeReporte = (r) => (Array.isArray(r?.campos) && r.campos.length ? r.campos : CAMPOS_ANTERIORES);
const conNombre = (t, nombre) => String(t || "").replace(/\{nombre\}/g, nombre || "________");
const textoValor = (c, v) => (Array.isArray(v) ? v.join(", ") : c.tipo === "escala" ? `${v} / 5` : c.tipo === "fecha" ? fechaLarga(v) : String(v));
const resumenReporte = (r) => {
  const qs = preguntas(camposDeReporte(r)).filter((x) => x.tipo !== "firma");
  const c = qs.find((x) => !vacio(x, r.respuestas?.[x.id]) && ["texto", "parrafo"].includes(x.tipo));
  if (c) return String(r.respuestas[c.id]).slice(0, 90);
  const sn = qs.filter((x) => x.tipo === "sino");
  if (sn.length) { const no = sn.filter((x) => r.respuestas?.[x.id] === "No").length; return no ? `⚠ ${no} ${no === 1 ? "actividad pendiente" : "actividades pendientes"} de ${sn.length}` : `✓ ${sn.length} de ${sn.length} actividades hechas`; }
  return r.titulo_form || "Check list de la clase";
};

// ── Firma con el dedo o el mouse (se guarda como imagen) ──
function Firma({ valor, onChange }) {
  const ref = useRef(null), dib = useRef(false), ult = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
    if (valor) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = valor; }
  }, []);
  const punto = (e) => { const r = ref.current.getBoundingClientRect(); const t = e.touches?.[0] || e; return { x: (t.clientX - r.left) * (ref.current.width / r.width), y: (t.clientY - r.top) * (ref.current.height / r.height) }; };
  const empezar = (e) => { e.preventDefault(); dib.current = true; ult.current = punto(e); };
  const mover = (e) => {
    if (!dib.current) return; e.preventDefault();
    const p = punto(e), ctx = ref.current.getContext("2d");
    ctx.strokeStyle = "#1E293B"; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(ult.current.x, ult.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ult.current = p;
  };
  const soltar = () => { if (!dib.current) return; dib.current = false; onChange(ref.current.toDataURL("image/png")); };
  const borrar = () => { ref.current.getContext("2d").clearRect(0, 0, ref.current.width, ref.current.height); onChange(""); };
  return (<div>
    <div style={{ position: "relative", border: `2px dashed ${valor ? "#059669" : "#CBD5E1"}`, borderRadius: 12, background: "#fff", maxWidth: 460 }}>
      <canvas ref={ref} width={460} height={150} style={{ width: "100%", height: 150, display: "block", touchAction: "none", cursor: "crosshair" }}
        onMouseDown={empezar} onMouseMove={mover} onMouseUp={soltar} onMouseLeave={soltar} onTouchStart={empezar} onTouchMove={mover} onTouchEnd={soltar} />
      {!valor && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 14, pointerEvents: "none" }}>✍️ Firma aquí</div>}
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 28, borderBottom: "1px solid #E2E8F0", pointerEvents: "none" }} />
    </div>
    {valor && <button type="button" onClick={borrar} style={{ ...btnO, marginTop: 6, fontSize: 12, padding: "5px 10px" }}>Borrar firma</button>}
  </div>);
}

// ── Una pregunta (para llenar o en la vista previa) ──
function Campo({ c, valor, onChange }) {
  const chip = (on, color = NAR) => ({ padding: "9px 16px", borderRadius: 999, border: `1.5px solid ${on ? color : "#E2E8F0"}`, background: on ? color : "#fff", color: on ? "#fff" : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" });
  if (c.tipo === "parrafo") return <textarea value={valor || ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder="Escribe aquí…" style={{ ...input, resize: "vertical", fontSize: 14, padding: "11px 13px", borderRadius: 10 }} />;
  if (c.tipo === "texto") return <input value={valor || ""} onChange={(e) => onChange(e.target.value)} placeholder="Escribe aquí…" style={{ ...input, fontSize: 14, padding: "11px 13px", borderRadius: 10 }} />;
  if (c.tipo === "numero") return <input type="number" value={valor ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...input, width: 140, fontSize: 14, padding: "11px 13px", borderRadius: 10 }} />;
  if (c.tipo === "fecha") return <input type="date" value={valor || ""} onChange={(e) => onChange(e.target.value)} style={{ ...input, width: 190, fontSize: 14, padding: "10px 12px", borderRadius: 10 }} />;
  if (c.tipo === "unica") return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(c.opciones || []).map((o) => <button key={o} type="button" onClick={() => onChange(valor === o ? "" : o)} style={chip(valor === o)}>{o}</button>)}</div>;
  if (c.tipo === "sino") return <div style={{ display: "flex", gap: 8 }}>{[["Sí", "#059669", "👍"], ["No", "#DC2626", "👎"]].map(([o, col, ic]) => <button key={o} type="button" onClick={() => onChange(valor === o ? "" : o)} style={{ ...chip(valor === o, col), minWidth: 90 }}>{ic} {o}</button>)}</div>;
  if (c.tipo === "escala") return <div style={{ display: "flex", gap: 6 }}>{CARAS.map((cara, i) => { const n = i + 1, on = Number(valor) === n; return (
    <button key={n} type="button" onClick={() => onChange(on ? "" : n)} title={`${n} de 5`} style={{ width: 52, height: 56, borderRadius: 12, border: `2px solid ${on ? NAR : "#E2E8F0"}`, background: on ? "#FFF7ED" : "#fff", cursor: "pointer", fontSize: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: on ? "scale(1.08)" : "none", transition: "all .15s" }}>
      <span style={{ filter: on || !valor ? "none" : "grayscale(1) opacity(.5)" }}>{cara}</span><span style={{ fontSize: 10, fontWeight: 700, color: on ? NAR : "#94A3B8" }}>{n}</span>
    </button>); })}</div>;
  if (c.tipo === "firma") return <Firma valor={valor} onChange={onChange} />;
  if (c.tipo === "varias") { const sel = Array.isArray(valor) ? valor : []; return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>{(c.opciones || []).map((o) => { const on = sel.includes(o); return (
      <button key={o} type="button" onClick={() => onChange(on ? sel.filter((x) => x !== o) : [...sel, o])} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, border: `1.5px solid ${on ? "#059669" : "#E2E8F0"}`, background: on ? "#ECFDF5" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#1E293B", textAlign: "left", transition: "all .15s" }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${on ? "#059669" : "#CBD5E1"}`, background: on ? "#059669" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Check size={14} strokeWidth={3} />}</span>{o}
      </button>); })}</div>); }
  return null;
}

// ── Todas las preguntas, en tarjetas ──
function Preguntas({ campos, respuestas, onCambio, nombre }) {
  let n = 0;
  return (campos || []).map((c) => {
    if (c.tipo === "mensaje") return (
      <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "linear-gradient(135deg,#FFF7ED,#FFFBF5)", border: "1px solid #FED7AA", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
        <span style={{ fontSize: 26 }}>{c.icono || "💡"}</span>
        <div><div style={{ fontSize: 14, fontWeight: 800, color: "#9A3412" }}>{conNombre(c.etiqueta, nombre)}</div>{c.ayuda && <div style={{ fontSize: 13, color: "#7C2D12", marginTop: 2 }}>{conNombre(c.ayuda, nombre)}</div>}</div>
      </div>);
    if (c.tipo === "seccion") return (
      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
        <span style={{ fontSize: 22 }}>{c.icono || "🔖"}</span>
        <div><div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>{c.etiqueta}</div>{c.ayuda && <div style={{ fontSize: 12, color: "#64748B" }}>{c.ayuda}</div>}</div>
        <div style={{ flex: 1, height: 2, background: "linear-gradient(to right,#FED7AA,transparent)" }} />
      </div>);
    n++;
    const lleno = !vacio(c, respuestas[c.id]);
    return (
      <div key={c.id} style={{ background: "#fff", border: `1px solid ${lleno ? "#FED7AA" : "#E2E8F0"}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10, boxShadow: lleno ? "0 2px 10px rgba(234,88,12,.08)" : "0 1px 2px rgba(15,23,42,.04)", transition: "all .2s" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: lleno ? "linear-gradient(135deg,#FFEDD5,#FED7AA)" : "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.icono || TIPOS.find((t) => t.v === c.tipo)?.i}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{c.tipo !== "firma" && <span style={{ color: "#CBD5E1", marginRight: 6 }}>{n}.</span>}{conNombre(c.etiqueta, nombre)}{c.req && <span style={{ color: NAR }}> *</span>}</div>
            {c.ayuda && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{c.ayuda}</div>}
          </div>
          {lleno && <span style={{ color: "#059669" }}><Check size={18} strokeWidth={3} /></span>}
        </div>
        <Campo c={c} valor={respuestas[c.id]} onChange={(v) => onCambio(c.id, v)} />
      </div>);
  });
}

function Portadilla({ titulo, descripcion, children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: "26px 24px", marginBottom: 16, color: "#fff", background: "radial-gradient(circle at 85% 20%, rgba(255,255,255,.25), transparent 40%), linear-gradient(135deg,#F97316 0%,#EA580C 45%,#C2410C 100%)", boxShadow: "0 14px 30px rgba(234,88,12,.25)" }}>
      <div aria-hidden style={{ position: "absolute", right: 14, top: 8, fontSize: 64, opacity: 0.9, transform: "rotate(8deg)", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.2))" }}>📋</div>
      <div aria-hidden style={{ position: "absolute", right: 90, bottom: -6, fontSize: 40, opacity: 0.8, transform: "rotate(-12deg)" }}>✏️</div>
      <div aria-hidden style={{ position: "absolute", right: 150, top: 14, fontSize: 28, opacity: 0.7 }}>⭐</div>
      <div style={{ position: "relative", maxWidth: "calc(100% - 120px)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.85 }}>Seeds English School</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1.15 }}>{titulo}</div>
        {descripcion && <div style={{ fontSize: 13, opacity: 0.92, marginTop: 6 }}>{descripcion}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Respuestas de un reporte (lectura) ──
export function VerRespuestas({ r, nombre }) {
  const viejo = !(Array.isArray(r?.campos) && r.campos.length);
  const campos = camposDeReporte(r).filter((c) => c.tipo !== "mensaje" && !(viejo && vacio(c, r.respuestas?.[c.id])));
  return (<div>{campos.map((c) => {
    if (c.tipo === "seccion") return <div key={c.id} style={{ fontSize: 13, fontWeight: 800, color: "#9A3412", margin: "16px 0 8px", display: "flex", gap: 6 }}><span>{c.icono || "🔖"}</span>{c.etiqueta}</div>;
    const v = r.respuestas?.[c.id];
    return (
      <div key={c.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{c.icono || TIPOS.find((t) => t.v === c.tipo)?.i}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ["sino", "firma"].includes(c.tipo) ? 13 : 11, fontWeight: 700, color: ["sino", "firma"].includes(c.tipo) ? "#1E293B" : "#64748B", textTransform: ["sino", "firma"].includes(c.tipo) ? "none" : "uppercase", letterSpacing: 0.3 }}>{conNombre(c.etiqueta, nombre)}</div>
          {vacio(c, v) ? <div style={{ fontSize: 13, color: "#CBD5E1", fontStyle: "italic" }}>Sin respuesta</div>
            : c.tipo === "varias" ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {(c.opciones || []).map((o) => { const on = v.includes(o); return <span key={o} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: on ? "#ECFDF5" : "#F8FAFC", color: on ? "#047857" : "#CBD5E1", border: `1px solid ${on ? "#A7F3D0" : "#F1F5F9"}`, textDecoration: on ? "none" : "line-through" }}>{on ? "✓ " : ""}{o}</span>; })}
                {v.filter((o) => !(c.opciones || []).includes(o)).map((o) => <span key={o} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "#ECFDF5", color: "#047857" }}>✓ {o}</span>)}
              </div>
            : c.tipo === "sino" ? <span style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontWeight: 800, padding: "3px 12px", borderRadius: 999, background: v === "Sí" ? "#ECFDF5" : "#FEF2F2", color: v === "Sí" ? "#047857" : "#DC2626" }}>{v === "Sí" ? "✓ Sí" : "✗ No"}</span>
            : c.tipo === "firma" ? <img src={v} alt="Firma" style={{ marginTop: 4, maxWidth: 260, height: "auto", borderBottom: "1px solid #CBD5E1" }} />
            : c.tipo === "escala" ? <div style={{ fontSize: 20, marginTop: 2 }}>{CARAS[Number(v) - 1]} <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{v} / 5</span></div>
            : <div style={{ fontSize: 14, color: "#1E293B", whiteSpace: "pre-wrap", marginTop: 2 }}>{textoValor(c, v)}</div>}
        </div>
      </div>);
  })}</div>);
}

// ════════════════════════════════════════════════════════════
//  DOCENTE: llenar el check list
// ════════════════════════════════════════════════════════════
export function FormularioClase({ datos, maestroId, avisar }) {
  const { form } = useFormulario();
  const nuevo = () => ({ seccion_id: datos.secciones[0]?.id || "", fecha: hoyISO(), respuestas: {} });
  const [envio, setEnvio] = useState(nuevo);
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [gracias, setGracias] = useState(false);
  const grupo = (id) => datos.secciones.find((s) => s.id === id)?.nombre || "—";
  const nombre = datos.maestro?.nombre || "";

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("reportes_clase").select("*").eq("maestro_id", maestroId).order("created_at", { ascending: false }).limit(60);
    if (!error) setLista(data || []);
  }, [maestroId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!form) return <div style={{ ...card, textAlign: "center", color: "#94A3B8" }}>Cargando…</div>;
  const qs = preguntas(form.campos);
  const hechas = qs.filter((c) => !vacio(c, envio.respuestas[c.id])).length;
  const pct = qs.length ? Math.round((hechas / qs.length) * 100) : 0;

  const enviar = async () => {
    if (!envio.seccion_id) { avisar("Elige el grupo", "error"); return; }
    if (!envio.fecha) { avisar("Elige la fecha de la clase", "error"); return; }
    const falta = qs.find((c) => c.req && vacio(c, envio.respuestas[c.id]));
    if (falta) { avisar(falta.tipo === "firma" ? "Falta tu firma" : `Falta: ${conNombre(falta.etiqueta, nombre)}`, "error"); return; }
    setGuardando(true);
    let fila = { id: uid(), seccion_id: envio.seccion_id, maestro_id: maestroId, fecha: envio.fecha, respuestas: envio.respuestas, campos: form.campos, titulo_form: form.titulo };
    let { error } = await supabase.from("reportes_clase").insert(fila);
    if (error && /column/i.test(error.message)) { const { campos, titulo_form, ...basica } = fila; ({ error } = await supabase.from("reportes_clase").insert(basica)); }
    setGuardando(false);
    if (error) { avisar("No se envió: " + error.message, "error"); return; }
    avisar("✓ Check list enviado");
    setEnvio(nuevo()); setGracias(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    cargar();
  };

  return (<div style={{ maxWidth: 760 }}>
    <Portadilla titulo={form.titulo} descripcion={form.descripcion}>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, maxWidth: 260, height: 8, borderRadius: 99, background: "rgba(255,255,255,.3)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#fff", borderRadius: 99, transition: "width .3s" }} /></div>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{hechas} de {qs.length}</span>
      </div>
    </Portadilla>

    <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, borderRadius: 14 }}>
      <div><label style={label}>👥 Grupo *</label>
        <select value={envio.seccion_id} onChange={(e) => setEnvio({ ...envio, seccion_id: e.target.value })} style={{ ...input, cursor: "pointer", fontWeight: 600 }}>
          {datos.secciones.length === 0 && <option value="">Sin grupos asignados</option>}
          {datos.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select></div>
      <div><label style={label}>📅 Fecha de la clase *</label><input type="date" value={envio.fecha} max={hoyISO()} onChange={(e) => setEnvio({ ...envio, fecha: e.target.value })} style={{ ...input, fontWeight: 600 }} /></div>
    </div>

    {gracias && <div style={{ ...card, borderRadius: 14, textAlign: "center", background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)", borderColor: "#A7F3D0" }}>
      <div style={{ fontSize: 44 }}>🎉</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#065F46", marginTop: 4 }}>¡Check list enviado!</div>
      <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>{form.despedida || FORM_DEFECTO.despedida}</div>
      <button onClick={() => setGracias(false)} style={{ ...btnO, marginTop: 12 }}><Plus size={14} />Llenar otro</button>
    </div>}
    {!gracias && <Preguntas nombre={nombre} campos={form.campos} respuestas={envio.respuestas} onCambio={(id, v) => setEnvio((e) => ({ ...e, respuestas: { ...e.respuestas, [id]: v } }))} />}

    {!gracias && <div style={{ position: "sticky", bottom: 10, display: "flex", justifyContent: "flex-end", margin: "14px 0 24px" }}>
      <button onClick={enviar} disabled={guardando} style={{ ...btn(), padding: "13px 24px", fontSize: 14, borderRadius: 12, boxShadow: "0 10px 24px rgba(234,88,12,.35)" }}><Send size={16} />{guardando ? "Enviando…" : "Enviar check list"}</button>
    </div>}

    <div style={{ ...card, borderRadius: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>Mis check list enviados</h3>
      {lista.length === 0 ? <div style={{ fontSize: 13, color: "#94A3B8", padding: "10px 0" }}>Todavía no has enviado ninguno.</div> : lista.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => setAbierto(abierto === r.id ? null : r.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 8, padding: "11px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ fontSize: 13, minWidth: 0 }}><strong>{grupo(r.seccion_id)}</strong> · <span style={{ color: "#475569" }}>{resumenReporte(r)}</span></span>
            <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{fechaLarga(r.fecha)} {r.leido_at && <span title="Administración ya lo vio">· ✓ visto</span>}</span>
          </button>
          {abierto === r.id && <div style={{ background: "#FFFBF7", borderRadius: 10, padding: "4px 14px", marginBottom: 10 }}><VerRespuestas r={r} nombre={nombre} /></div>}
        </div>
      ))}
    </div>
  </div>);
}

// ════════════════════════════════════════════════════════════
//  ADMINISTRACIÓN: bandeja + editor
// ════════════════════════════════════════════════════════════
export function AdminChecklist({ data, showToast, setError }) {
  const [tab, setTab] = useState("bandeja");
  const [noLeidos, setNoLeidos] = useState(0);
  const t = (a) => ({ ...btnO, background: a ? "#FFF7ED" : "#fff", color: a ? NAR : "#64748B", borderColor: a ? "#FDBA74" : "#D1D5DB", fontWeight: a ? 700 : 400 });
  return (<div>
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      <button onClick={() => setTab("bandeja")} style={t(tab === "bandeja")}><Inbox size={14} />Bandeja{noLeidos > 0 && <span style={{ background: NAR, color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>{noLeidos}</span>}</button>
      <button onClick={() => setTab("editar")} style={t(tab === "editar")}><Pencil size={14} />Editar formulario</button>
    </div>
    {tab === "bandeja" ? <Bandeja data={data} setError={setError} onNoLeidos={setNoLeidos} /> : <EditorFormulario showToast={showToast} />}
  </div>);
}

function Bandeja({ data, setError, onNoLeidos }) {
  const [lista, setLista] = useState(null);
  const [orden, setOrden] = useState("llegada");
  const [maestro, setMaestro] = useState("");
  const [grupo, setGrupo] = useState("");
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [sel, setSel] = useState(null);
  const escritorio = window.innerWidth > 900;

  const cargar = useCallback(async () => {
    const { data: d, error } = await supabase.from("reportes_clase").select("*").order("created_at", { ascending: false }).limit(400);
    if (error) { setError(error.message); setLista([]); return; }
    setError(""); setLista(d || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onNoLeidos((lista || []).filter((r) => !r.leido_at).length); }, [lista]);

  const nombreM = (id) => data.maestros.find((m) => m.id === id)?.nombre || "Docente";
  const nombreG = (id) => data.secciones.find((s) => s.id === id)?.nombre || "—";
  const visibles = (lista || []).filter((r) => (!maestro || r.maestro_id === maestro) && (!grupo || r.seccion_id === grupo) && (!soloNuevos || !r.leido_at));
  const actual = (lista || []).find((r) => r.id === sel);

  const marcar = async (r, leido) => {
    const leido_at = leido ? new Date().toISOString() : null;
    setLista((l) => l.map((x) => (x.id === r.id ? { ...x, leido_at } : x)));
    await supabase.from("reportes_clase").update({ leido_at }).eq("id", r.id);
  };
  const abrir = (r) => { setSel(r.id); if (!r.leido_at) marcar(r, true); };

  // Por maestro: agrupado, con los que tienen pendientes primero
  const grupos = orden === "maestro"
    ? Object.values(visibles.reduce((acc, r) => { (acc[r.maestro_id] = acc[r.maestro_id] || { id: r.maestro_id, items: [] }).items.push(r); return acc; }, {}))
        .sort((a, b) => b.items.filter((r) => !r.leido_at).length - a.items.filter((r) => !r.leido_at).length || nombreM(a.id).localeCompare(nombreM(b.id)))
    : [{ id: "", items: visibles }];

  const fila = (r) => { const on = r.id === sel, nuevo = !r.leido_at; return (
    <button key={r.id} onClick={() => abrir(r)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", border: "none", borderBottom: "1px solid #F1F5F9", borderLeft: `3px solid ${on ? NAR : "transparent"}`, background: on ? "#FFF7ED" : nuevo ? "#fff" : "#FAFAFA", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: colorDe(r.maestro_id), color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{iniciales(nombreM(r.maestro_id))}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: nuevo ? 800 : 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreM(r.maestro_id)}</span>
          <span style={{ fontSize: 11, color: nuevo ? NAR : "#94A3B8", fontWeight: nuevo ? 700 : 400, whiteSpace: "nowrap" }}>{hace(r.created_at)}</span>
        </div>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: nuevo ? 600 : 400 }}>{nombreG(r.seccion_id)} · clase del {fechaLarga(r.fecha)}</div>
        <div style={{ fontSize: 12, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumenReporte(r)}</div>
      </div>
      {nuevo && <span style={{ width: 9, height: 9, borderRadius: "50%", background: NAR, marginTop: 5, flexShrink: 0 }} />}
    </button>); };

  const lista_ = (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ padding: 12, borderBottom: "1px solid #E2E8F0", display: "grid", gap: 8, background: "#F8FAFC" }}>
        <div style={{ display: "flex", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: 3 }}>
          {[["llegada", "Por llegada"], ["maestro", "Por maestro"]].map(([v, l]) => <button key={v} onClick={() => setOrden(v)} style={{ flex: 1, padding: "6px 8px", border: "none", borderRadius: 6, background: orden === v ? NAR : "transparent", color: orden === v ? "#fff" : "#64748B", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={maestro} onChange={(e) => setMaestro(e.target.value)} style={{ ...input, padding: "7px 8px", fontSize: 12 }}>
            <option value="">Todos los maestros</option>
            {[...data.maestros].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} style={{ ...input, padding: "7px 8px", fontSize: 12 }}>
            <option value="">Todos los grupos</option>
            {data.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={soloNuevos} onChange={(e) => setSoloNuevos(e.target.checked)} />Solo los no leídos</label>
      </div>
      <div style={{ maxHeight: escritorio ? 620 : "none", overflowY: "auto" }}>
        {lista === null ? <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Cargando…</div>
          : visibles.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>📭 No hay check list {soloNuevos ? "sin leer" : "con esos filtros"}.</div>
          : grupos.map((g) => (<div key={g.id || "todos"}>
              {orden === "maestro" && <div style={{ padding: "8px 14px", background: "#F1F5F9", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", justifyContent: "space-between" }}>
                <span>{nombreM(g.id)}</span><span>{g.items.length}{g.items.some((r) => !r.leido_at) ? ` · ${g.items.filter((r) => !r.leido_at).length} nuevos` : ""}</span></div>}
              {g.items.map(fila)}
            </div>))}
      </div>
    </div>
  );

  const detalle = actual ? (
    <div style={{ ...card, marginBottom: 0, borderRadius: 14 }}>
      {!escritorio && <button onClick={() => setSel(null)} style={{ ...btnO, marginBottom: 12 }}><ArrowLeft size={14} />Volver a la bandeja</button>}
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: 14, borderBottom: "2px solid #FFEDD5", flexWrap: "wrap" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: colorDe(actual.maestro_id), color: "#fff", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{iniciales(nombreM(actual.maestro_id))}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B" }}>{nombreM(actual.maestro_id)}</div>
          <div style={{ fontSize: 13, color: "#475569" }}>{nombreG(actual.seccion_id)} · clase del {fechaLarga(actual.fecha)}</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{actual.titulo_form || "Check list de la clase"} · recibido {new Date(actual.created_at).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
        <button onClick={() => marcar(actual, !actual.leido_at)} style={btnO}>{actual.leido_at ? <><Mail size={14} />Marcar no leído</> : <><MailOpen size={14} />Marcar leído</>}</button>
        <button onClick={() => window.print()} style={btnO}><Printer size={14} />Imprimir</button>
      </div>
      <VerRespuestas r={actual} nombre={nombreM(actual.maestro_id)} />
    </div>
  ) : (
    <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: "60px 20px", color: "#94A3B8", borderRadius: 14 }}>
      <div style={{ fontSize: 48 }}>📬</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginTop: 8 }}>Elige un check list de la bandeja</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{(lista || []).filter((r) => !r.leido_at).length} sin leer de {(lista || []).length}</div>
    </div>
  );

  if (!escritorio) return sel ? detalle : lista_;
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,380px) 1fr", gap: 16, alignItems: "start" }}>{lista_}{detalle}</div>;
}

// ── Editor del formulario ──
function EditorFormulario({ showToast }) {
  const { form, activo, recargar } = useFormulario();
  const [borrador, setBorrador] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [iconosDe, setIconosDe] = useState(null);
  const [vista, setVista] = useState({});
  const [guardando, setGuardando] = useState(false);
  const escritorio = window.innerWidth > 1000;
  const base = () => JSON.parse(JSON.stringify({ titulo: form.titulo, descripcion: form.descripcion || "", despedida: form.despedida || "", campos: form.campos }));
  useEffect(() => { if (form) setBorrador(base()); }, [form]);
  if (!borrador) return <div style={{ ...card, textAlign: "center", color: "#94A3B8" }}>Cargando…</div>;

  const cambios = JSON.stringify(borrador) !== JSON.stringify(base());
  const setCampos = (f) => setBorrador((b) => ({ ...b, campos: f(b.campos) }));
  const editar = (id, cambio) => setCampos((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambio } : c)));
  const mover = (i, d) => setCampos((cs) => { const n = [...cs]; const j = i + d; if (j < 0 || j >= n.length) return cs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const agregar = (tipo) => {
    const t = TIPOS.find((x) => x.v === tipo);
    const c = { id: uid(), tipo, etiqueta: tipo === "seccion" ? "Nueva sección" : "Nueva pregunta", icono: t.i, ...(["unica", "varias"].includes(tipo) ? { opciones: ["Opción 1", "Opción 2"] } : {}) };
    setCampos((cs) => [...cs, c]); setAbierta(c.id);
  };
  const guardar = async () => {
    if (!borrador.titulo.trim()) { showToast("Ponle un título al formulario", "error"); return; }
    const campos = borrador.campos.map((c) => ({ ...c, etiqueta: c.etiqueta.trim() || "Pregunta", opciones: c.opciones ? c.opciones.map((o) => o.trim()).filter(Boolean) : undefined }));
    const malo = campos.find((c) => ["unica", "varias"].includes(c.tipo) && !(c.opciones || []).length);
    if (malo) { showToast(`"${malo.etiqueta}" necesita al menos una opción`, "error"); return; }
    setGuardando(true);
    const { error } = await supabase.from("formularios").upsert({ id: FORM_DEFECTO.id, titulo: borrador.titulo.trim(), descripcion: borrador.descripcion.trim() || null, despedida: borrador.despedida.trim() || null, campos, updated_at: new Date().toISOString() });
    setGuardando(false);
    if (error) { showToast("No se guardó: " + errorTexto(error), "error"); return; }
    showToast("✓ Formulario guardado. Los docentes ya ven la nueva versión.");
    recargar();
  };

  const editor = (<div>
    {!activo && <div style={{ ...card, background: "#FFF7ED", borderColor: "#FDBA74", color: "#9A3412", fontSize: 13 }}>⚠ Falta activar el formulario editable en Supabase (script <code>supabase/formularios.sql</code>).</div>}
    <div style={{ ...card, borderRadius: 14 }}>
      <label style={label}>Título del formulario</label>
      <input value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} style={{ ...input, fontSize: 15, fontWeight: 700, marginBottom: 10 }} />
      <label style={label}>Descripción (opcional)</label>
      <input value={borrador.descripcion} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} style={{ ...input, marginBottom: 10 }} />
      <label style={label}>Mensaje al enviar</label>
      <input value={borrador.despedida} onChange={(e) => setBorrador({ ...borrador, despedida: e.target.value })} style={input} />
      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>La fecha, el nombre del docente y el grupo los pone el sistema. En cualquier texto puedes escribir <code>{"{nombre}"}</code> y se cambia por el nombre del docente.</div>
    </div>
    {borrador.campos.map((c, i) => { const abiertoC = abierta === c.id; const t = TIPOS.find((x) => x.v === c.tipo); return (
      <div key={c.id} style={{ background: "#fff", border: `1px solid ${abiertoC ? "#FDBA74" : "#E2E8F0"}`, borderRadius: 12, marginBottom: 8, boxShadow: abiertoC ? "0 6px 18px rgba(234,88,12,.12)" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }} onClick={() => setAbierta(abiertoC ? null : c.id)}>
          <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{c.icono || t?.i}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: c.tipo === "seccion" ? 800 : 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.etiqueta}{c.req && <span style={{ color: NAR }}> *</span>}</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>{t?.l}{c.opciones ? ` · ${c.opciones.length} opciones` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
            <button title="Subir" onClick={() => mover(i, -1)} disabled={i === 0} style={{ ...btnO, padding: 5, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={14} /></button>
            <button title="Bajar" onClick={() => mover(i, 1)} disabled={i === borrador.campos.length - 1} style={{ ...btnO, padding: 5, opacity: i === borrador.campos.length - 1 ? 0.3 : 1 }}><ChevronDown size={14} /></button>
            <button title="Duplicar" onClick={() => setCampos((cs) => { const n = [...cs]; n.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(c)), id: uid(), etiqueta: c.etiqueta + " (copia)" }); return n; })} style={{ ...btnO, padding: 5 }}><Copy size={14} /></button>
            <button title="Quitar" onClick={() => { if (confirm(`¿Quitar "${c.etiqueta}" del formulario? Los check list ya enviados no cambian.`)) setCampos((cs) => cs.filter((x) => x.id !== c.id)); }} style={{ ...btnO, padding: 5, color: "#DC2626", borderColor: "#FECACA" }}><Trash2 size={14} /></button>
          </div>
        </div>
        {abiertoC && <div style={{ padding: "4px 14px 14px", borderTop: "1px solid #F1F5F9", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <label style={label}>Imagen</label>
              <button onClick={() => setIconosDe(iconosDe === c.id ? null : c.id)} style={{ ...btnO, fontSize: 22, padding: "3px 10px" }}>{c.icono || t?.i}</button>
              {iconosDe === c.id && <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, marginTop: 4, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 8, boxShadow: "0 12px 30px rgba(15,23,42,.18)", display: "grid", gridTemplateColumns: "repeat(7,36px)", gap: 4 }}>
                {ICONOS.map((ic) => <button key={ic} onClick={() => { editar(c.id, { icono: ic }); setIconosDe(null); }} style={{ width: 36, height: 36, fontSize: 20, border: "none", borderRadius: 8, background: c.icono === ic ? "#FFEDD5" : "transparent", cursor: "pointer" }}>{ic}</button>)}
              </div>}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}><label style={label}>{c.tipo === "seccion" ? "Título de la sección" : "Pregunta"}</label><input value={c.etiqueta} onChange={(e) => editar(c.id, { etiqueta: e.target.value })} style={input} /></div>
            <div><label style={label}>Tipo</label>
              <select value={c.tipo} onChange={(e) => { const tipo = e.target.value; editar(c.id, { tipo, ...(["unica", "varias"].includes(tipo) && !c.opciones ? { opciones: ["Opción 1", "Opción 2"] } : {}) }); }} style={{ ...input, width: "auto", cursor: "pointer" }}>
                {TIPOS.map((x) => <option key={x.v} value={x.v}>{x.i} {x.l}</option>)}
              </select></div>
          </div>
          <div><label style={label}>Ayuda (opcional, texto pequeño debajo)</label><input value={c.ayuda || ""} onChange={(e) => editar(c.id, { ayuda: e.target.value })} style={input} /></div>
          {["unica", "varias"].includes(c.tipo) && <div><label style={label}>Opciones (una por línea)</label>
            <textarea value={(c.opciones || []).join("\n")} onChange={(e) => editar(c.id, { opciones: e.target.value.split("\n") })} rows={Math.max(3, (c.opciones || []).length + 1)} style={{ ...input, resize: "vertical", lineHeight: 1.6 }} /></div>}
          {!["seccion", "mensaje"].includes(c.tipo) && <label style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={!!c.req} onChange={(e) => editar(c.id, { req: e.target.checked })} />Obligatoria</label>}
        </div>}
      </div>); })}
    <div style={{ ...card, borderRadius: 14, borderStyle: "dashed", background: "#FFFBF7" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9A3412", marginBottom: 8 }}><Plus size={13} style={{ verticalAlign: -2 }} /> Agregar</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TIPOS.map((x) => <button key={x.v} onClick={() => agregar(x.v)} style={{ ...btnO, fontSize: 12, padding: "6px 10px" }}>{x.i} {x.l}</button>)}</div>
    </div>
    <div style={{ position: cambios ? "sticky" : "static", bottom: 10, display: "flex", justifyContent: "flex-end", gap: 8, zIndex: 5 }}>
      {cambios && <button onClick={() => setBorrador(base())} style={btnO}>Descartar cambios</button>}
      <button onClick={guardar} disabled={guardando || !cambios} style={{ ...btn(), opacity: guardando || !cambios ? 0.5 : 1, boxShadow: cambios ? "0 10px 24px rgba(234,88,12,.35)" : "none" }}><Save size={15} />{guardando ? "Guardando…" : cambios ? "Guardar formulario" : "✓ Guardado"}</button>
    </div>
  </div>);

  const preview = (<div>
    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Eye size={14} />Así lo ve el docente</div>
    <div style={{ background: "#F8FAFC", borderRadius: 16, padding: 14, border: "1px solid #E2E8F0" }}>
      <Portadilla titulo={borrador.titulo || "Sin título"} descripcion={borrador.descripcion} />
      <Preguntas nombre="Ana Martínez" campos={borrador.campos} respuestas={vista} onCambio={(id, v) => setVista((x) => ({ ...x, [id]: v }))} />
    </div>
  </div>);

  return escritorio
    ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>{editor}<div style={{ position: "sticky", top: 10, maxHeight: "calc(100vh - 20px)", overflowY: "auto" }}>{preview}</div></div>
    : <div>{editor}<div style={{ marginTop: 20 }}>{preview}</div></div>;
}
