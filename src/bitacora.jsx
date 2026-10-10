// ── BITÁCORA DE CLASES (flipbook) ──
// Cada docente tiene una página por fecha. Se puede hojear como un libro,
// escribir lo que se hizo en clase, y descargar o imprimir todo en PDF.
// Administración ve (sin editar) la bitácora de cada docente.
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SEEDS } from "./logo";
import SCRIPT_BITACORA from "../supabase/bitacora.sql?raw";
import { ChevronLeft, ChevronRight, Save, Trash2, Download, Printer, Plus, BookOpen, Eye, X, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Highlighter, RemoveFormatting } from "lucide-react";

const NAR = "#EA580C";
const card = { background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: 20, marginBottom: 16 };
const input = { width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const btn = (c = NAR) => ({ padding: "9px 16px", background: c, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" });
const btnO = { padding: "8px 12px", background: "#fff", color: "#475569", border: "1px solid #D1D5DB", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" };
const hoyISO = () => new Date().toLocaleDateString("en-CA");
const fechaTitulo = (f) => { const t = new Date(f + "T12:00:00").toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const fechaCorta = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-HN", { day: "numeric", month: "short" });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// ── Texto con formato ──
// El contenido se guarda como HTML sencillo. Antes de mostrarlo o imprimirlo
// se limpia: solo se permiten etiquetas y estilos de formato de texto.
const ETIQUETAS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT", "BR", "DIV", "P", "MARK", "UL", "OL", "LI"]);
const ESTILOS_OK = ["color", "background-color", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "text-decoration-line"];
const esHtml = (t) => /<[a-z][\s\S]*>/i.test(String(t || ""));
const textoAHtml = (t) => esc(t).replace(/\n/g, "<br>");
function limpiarHtml(html) {
  if (!html) return "";
  if (!esHtml(html)) return textoAHtml(html);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const recorrer = (nodo) => {
    [...nodo.childNodes].forEach((n) => {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1 || !ETIQUETAS.has(n.tagName)) {
        if (n.nodeType === 1 && !["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(n.tagName)) { recorrer(n); n.replaceWith(...n.childNodes); } else n.remove();
        return;
      }
      [...n.attributes].forEach((a) => {
        if (a.name === "style") {
          const ok = a.value.split(";").map((x) => x.trim()).filter((x) => ESTILOS_OK.includes(x.split(":")[0].trim().toLowerCase()) && !/url\(|expression/i.test(x));
          if (ok.length) n.setAttribute("style", ok.join("; ")); else n.removeAttribute("style");
        } else if (!(n.tagName === "FONT" && ["color", "face", "size"].includes(a.name))) n.removeAttribute(a.name);
      });
      recorrer(n);
    });
  };
  const raiz = doc.body.firstChild;
  recorrer(raiz);
  return raiz.innerHTML;
}
const textoPlano = (html) => { if (!esHtml(html)) return String(html || ""); const d = new DOMParser().parseFromString(html, "text/html"); return (d.body.innerText || d.body.textContent || "").trim(); };

const FUENTES = [
  { l: "Clásica", v: "Georgia, 'Times New Roman', serif" },
  { l: "Moderna", v: "'Segoe UI', Arial, sans-serif" },
  { l: "A mano", v: "Caveat, 'Segoe Print', cursive" },
  { l: "Escolar", v: "'Comic Sans MS', 'Comic Neue', cursive" },
  { l: "Máquina", v: "'Courier New', Courier, monospace" },
];
const TAMANOS = [{ l: "Pequeña", v: "2" }, { l: "Normal", v: "3" }, { l: "Grande", v: "5" }, { l: "Muy grande", v: "6" }];
const COLORES = ["#1E293B", "#2563EB", "#DC2626", "#059669", "#EA580C", "#7C3AED", "#DB2777", "#92400E"];
const RESALTES = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA"];

// Barra de formato (usa el editor del navegador sobre el texto seleccionado)
function BarraFormato({ editorRef, onCambio }) {
  const aplicar = (cmd, valor = null) => {
    editorRef.current?.focus();
    try { document.execCommand("styleWithCSS", false, true); } catch (e) { /* navegadores viejos */ }
    document.execCommand(cmd, false, valor);
    onCambio();
  };
  const b = { background: "#fff", border: "1px solid #E7DCC8", borderRadius: 6, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", padding: 0 };
  const sel = { ...input, width: "auto", padding: "5px 6px", fontSize: 12, height: 30, cursor: "pointer", background: "#fff", borderColor: "#E7DCC8" };
  const sep = <span style={{ width: 1, height: 22, background: "#E7DCC8", margin: "0 2px" }} />;
  // onMouseDown + preventDefault: así no se pierde el texto seleccionado al tocar un botón
  const boton = (titulo, icono, cmd, valor) => <button type="button" title={titulo} onMouseDown={(e) => { e.preventDefault(); aplicar(cmd, valor); }} style={b}>{icono}</button>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", padding: "8px 12px", background: "#FBF7EF", borderBottom: "1px solid #E7DCC8" }}>
      {boton("Negrita (Ctrl+B)", <Bold size={15} />, "bold")}
      {boton("Cursiva (Ctrl+I)", <Italic size={15} />, "italic")}
      {boton("Subrayar (Ctrl+U)", <Underline size={15} />, "underline")}
      {boton("Tachar", <Strikethrough size={15} />, "strikeThrough")}
      {sep}
      <select title="Tipo de letra" defaultValue="" onChange={(e) => { if (e.target.value) aplicar("fontName", e.target.value); e.target.value = ""; }} style={sel}>
        <option value="">Letra…</option>
        {FUENTES.map((f) => <option key={f.l} value={f.v} style={{ fontFamily: f.v }}>{f.l}</option>)}
      </select>
      <select title="Tamaño de letra" defaultValue="" onChange={(e) => { if (e.target.value) aplicar("fontSize", e.target.value); e.target.value = ""; }} style={sel}>
        <option value="">Tamaño…</option>
        {TAMANOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
      </select>
      {sep}
      <span title="Color de letra" style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700 }}>A</span>
        {COLORES.map((c) => <button key={c} type="button" title="Color de letra" onMouseDown={(e) => { e.preventDefault(); aplicar("foreColor", c); }} style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px #E2E8F0", background: c, cursor: "pointer", padding: 0 }} />)}
      </span>
      {sep}
      <span title="Resaltar" style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
        <Highlighter size={14} color="#94A3B8" />
        {RESALTES.map((c) => <button key={c} type="button" title="Resaltar" onMouseDown={(e) => { e.preventDefault(); aplicar("hiliteColor", c); }} style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #E2E8F0", background: c, cursor: "pointer", padding: 0 }} />)}
      </span>
      {sep}
      {boton("Lista con viñetas", <List size={15} />, "insertUnorderedList")}
      {boton("Lista numerada", <ListOrdered size={15} />, "insertOrderedList")}
      {boton("Quitar formato", <RemoveFormatting size={15} />, "removeFormat")}
    </div>
  );
}

const falta = (e) => /relation .*bitacora.* does not exist|Could not find the table .*bitacora|schema cache/i.test(String(e?.message || e || ""));
const EDITOR_SQL = (() => { const ref = (String(supabase.supabaseUrl || "").match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1]; return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard"; })();

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
@keyframes bt-hoja { from { transform: perspective(1600px) rotateY(-75deg); opacity: .35 } to { transform: perspective(1600px) rotateY(0); opacity: 1 } }
@keyframes bt-hoja-atras { from { transform: perspective(1600px) rotateY(75deg); opacity: .35 } to { transform: perspective(1600px) rotateY(0); opacity: 1 } }
.bt-pasar { animation: bt-hoja .55s cubic-bezier(.2,.8,.2,1); transform-origin: left center }
.bt-pasar-atras { animation: bt-hoja-atras .55s cubic-bezier(.2,.8,.2,1); transform-origin: right center }
.bt-renglones { background-color: #FFFEF9; background-image: linear-gradient(to right, transparent 46px, #F4A9A8 46px, #F4A9A8 48px, transparent 48px), repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #D6E4F0 31px, #D6E4F0 32px); background-attachment: local }
.bt-texto { font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 32px; color: #1E293B; padding: 4px 18px 16px 60px; white-space: pre-wrap; word-break: break-word }
.bt-texto::placeholder { color: #94A3B8; font-style: italic }
.bt-texto[contenteditable]:empty:before { content: attr(data-placeholder); color: #94A3B8; font-style: italic; pointer-events: none }
.bt-texto ul, .bt-texto ol { padding-left: 24px; margin: 0 }
.bt-texto p, .bt-texto div { margin: 0 }
.bt-titulo { font-family: 'Caveat', 'Segoe Print', cursive; font-size: 30px; font-weight: 700; color: #9A3412; line-height: 1.15 }
.bt-indice button:hover { background: #FFEDD5 }
`;

// Aviso para activar la bitácora (solo administración puede hacerlo)
function AvisoActivar({ esAdmin, avisar }) {
  const [copiado, setCopiado] = useState(false);
  if (!esAdmin) return <div style={{ ...card, background: "#FFF7ED", border: "1px solid #FDBA74", color: "#9A3412", fontSize: 13 }}>⚠ La bitácora todavía no está activada. Pide a administración que la active.</div>;
  const copiar = async () => { try { await navigator.clipboard.writeText(SCRIPT_BITACORA); setCopiado(true); avisar && avisar("✓ Script copiado. Ahora pégalo en Supabase"); } catch (e) { avisar && avisar("No se pudo copiar automáticamente", "error"); } };
  return (
    <div style={{ ...card, background: "#FFF7ED", border: "1px solid #FDBA74" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#9A3412", marginBottom: 6 }}>⚠ Falta activar la bitácora (se hace una sola vez)</div>
      <ol style={{ fontSize: 13, color: "#7C2D12", margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Toca <strong>“1. Copiar script”</strong>.</li>
        <li>Toca <strong>“2. Abrir Supabase”</strong>, pega con <strong>Ctrl + V</strong> y toca <strong>Run</strong>.</li>
        <li>Vuelve aquí y recarga con <strong>Ctrl + Shift + R</strong>.</li>
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copiar} style={btn()}>{copiado ? "✓ Copiado" : "1. Copiar script"}</button>
        <a href={EDITOR_SQL} target="_blank" rel="noreferrer" style={btn("#1E293B")}>2. Abrir Supabase</a>
      </div>
    </div>
  );
}

// Documento HTML de la bitácora (para PDF e impresión)
function documentoBitacora(paginas, maestroNombre, secciones) {
  const grupo = (id) => secciones.find((s) => s.id === id)?.nombre || "";
  const rango = paginas.length ? `${fechaTitulo(paginas[0].fecha)} — ${fechaTitulo(paginas[paginas.length - 1].fecha)}` : "";
  const css = `
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bt-doc{font-family:'Segoe UI',system-ui,sans-serif;color:#1E293B;background:#fff}
    .bt-portada{height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:3px solid #EA580C;border-radius:14px;padding:30px}
    .bt-portada img{width:160px;height:160px;object-fit:contain}
    .bt-portada h1{font-family:'Caveat','Segoe Print',cursive;font-size:56px;color:#9A3412;margin-top:18px}
    .bt-portada h2{font-size:22px;margin-top:8px}
    .bt-portada p{font-size:13px;color:#64748B;margin-top:6px}
    .bt-pag{page-break-before:always;break-before:page;padding:6mm 2mm}
    .bt-cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #EA580C;padding-bottom:8px;margin-bottom:12px}
    .bt-cab .f{font-size:17px;font-weight:800}
    .bt-cab .g{font-size:12px;color:#64748B}
    .bt-cab .n{font-size:11px;color:#94A3B8}
    .bt-tit{font-family:'Caveat','Segoe Print',cursive;font-size:30px;font-weight:700;color:#9A3412;margin-bottom:6px}
    .bt-cont ul,.bt-cont ol{padding-left:24px}
    .bt-cont{font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:28px;white-space:pre-wrap;word-break:break-word;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,#E2E8F0 27px,#E2E8F0 28px);min-height:200mm}
    .bt-pie{font-size:10px;color:#94A3B8;text-align:center;margin-top:10px}`;
  const cuerpo = `
    <div class="bt-portada">
      <img src="${LOGO_SEEDS}" alt="Seeds"/>
      <h1>Bitácora de clases</h1>
      <h2>${esc(maestroNombre)}</h2>
      <p>Seeds English School · Jesús de Otoro, Intibucá, Honduras</p>
      <p>${paginas.length} ${paginas.length === 1 ? "página" : "páginas"}${rango ? ` · ${esc(rango)}` : ""}</p>
    </div>
    ${paginas.map((p, i) => `
      <div class="bt-pag">
        <div class="bt-cab"><div><div class="f">${esc(fechaTitulo(p.fecha))}</div>${p.seccion_id ? `<div class="g">${esc(grupo(p.seccion_id))}</div>` : ""}</div><div class="n">Página ${i + 1} de ${paginas.length}</div></div>
        ${p.titulo ? `<div class="bt-tit">${esc(p.titulo)}</div>` : ""}
        <div class="bt-cont">${limpiarHtml(p.contenido) || "&nbsp;"}</div>
        <div class="bt-pie">Bitácora de ${esc(maestroNombre)} · Seeds English School</div>
      </div>`).join("")}`;
  return { css, cuerpo };
}

// ════════════════════════════════════════════════════════════
//  FLIPBOOK
// ════════════════════════════════════════════════════════════
export function Bitacora({ maestro, secciones, editable, avisar, esAdmin }) {
  const [paginas, setPaginas] = useState(null); // null = cargando
  const [noActivada, setNoActivada] = useState(false);
  const [fecha, setFecha] = useState(null);      // página abierta
  const [borrador, setBorrador] = useState({ titulo: "", contenido: "", seccion_id: "" });
  const [dir, setDir] = useState("adelante");
  const [giro, setGiro] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [generando, setGenerando] = useState(false);
  const escritorio = window.innerWidth > 860;
  const editorRef = useRef(null);

  const cargar = useCallback(async (abrir) => {
    if (!maestro?.id) return;
    const { data, error } = await supabase.from("bitacora").select("*").eq("maestro_id", maestro.id).order("fecha", { ascending: true });
    if (error) { if (falta(error)) setNoActivada(true); else avisar && avisar("Error: " + error.message, "error"); setPaginas([]); return; }
    setNoActivada(false);
    setPaginas(data || []);
    const ultima = (data || []).at(-1)?.fecha;
    setFecha((f) => abrir || f || (editable ? hoyISO() : ultima) || null);
  }, [maestro?.id, editable]);
  useEffect(() => { setFecha(null); setPaginas(null); cargar(); }, [maestro?.id]);

  const actual = paginas?.find((p) => p.fecha === fecha) || null;
  useEffect(() => {
    const html = limpiarHtml(actual?.contenido || "");
    setBorrador({ titulo: actual?.titulo || "", contenido: html, seccion_id: actual?.seccion_id || (secciones.length === 1 ? secciones[0].id : "") });
    if (editorRef.current) editorRef.current.innerHTML = html;
  }, [fecha, actual?.id, actual?.updated_at]);
  // El editor se monta después (la primera vez): ponerle el contenido
  const montarEditor = (el) => { if (el && el !== editorRef.current) { editorRef.current = el; el.innerHTML = borrador.contenido; } };
  const leerEditor = () => { const el = editorRef.current; if (!el) return; const html = textoPlano(el.innerHTML) || /<(ul|ol|li)/i.test(el.innerHTML) ? el.innerHTML : ""; setBorrador((b) => ({ ...b, contenido: html })); };

  if (noActivada) return <AvisoActivar esAdmin={esAdmin} avisar={avisar} />;
  if (paginas === null) return <div style={{ ...card, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Cargando bitácora…</div>;

  const cambios = editable && ((actual?.titulo || "") !== borrador.titulo || limpiarHtml(actual?.contenido || "") !== borrador.contenido || (actual?.seccion_id || "") !== (borrador.seccion_id || "")) && (actual || borrador.titulo.trim() || borrador.contenido.trim());
  const fechas = [...new Set([...paginas.map((p) => p.fecha), ...(fecha ? [fecha] : [])])].sort();
  const pos = fechas.indexOf(fecha);
  const grupo = (id) => secciones.find((s) => s.id === id)?.nombre || "";

  const ir = (f, hacia) => {
    if (!f || f === fecha) return;
    if (cambios && !confirm("Esta página tiene cambios sin guardar. ¿Pasar de página sin guardar?")) return;
    setDir(hacia || (f > fecha ? "adelante" : "atras"));
    setGiro((g) => g + 1);
    setFecha(f);
  };
  const guardar = async () => {
    if (!textoPlano(borrador.contenido) && !borrador.titulo.trim()) { avisar("Escribe algo en la página antes de guardar", "error"); return; }
    setGuardando(true);
    const fila = { id: `${maestro.id}_${fecha}`, maestro_id: maestro.id, seccion_id: borrador.seccion_id || null, fecha, titulo: borrador.titulo.trim() || null, contenido: limpiarHtml(borrador.contenido), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("bitacora").upsert(fila, { onConflict: "maestro_id,fecha" });
    setGuardando(false);
    if (error) { avisar("No se guardó: " + error.message, "error"); return; }
    avisar("✓ Página guardada");
    cargar(fecha);
  };
  const borrar = async () => {
    if (!actual) { setBorrador({ titulo: "", contenido: "", seccion_id: borrador.seccion_id }); if (editorRef.current) editorRef.current.innerHTML = ""; return; }
    if (!confirm(`¿Borrar la página del ${fechaTitulo(fecha)}?`)) return;
    const { error } = await supabase.from("bitacora").delete().eq("id", actual.id);
    if (error) { avisar("No se borró: " + error.message, "error"); return; }
    avisar("Página borrada", "error");
    cargar();
  };

  const guardadas = paginas.filter((p) => textoPlano(p.contenido) || p.titulo);
  const descargarPDF = async () => {
    if (!guardadas.length) { avisar("Todavía no hay páginas guardadas", "error"); return; }
    setGenerando(true);
    try {
      const { css, cuerpo } = documentoBitacora(guardadas, maestro.nombre, secciones);
      const html2pdf = (await import("html2pdf.js")).default;
      const blob = await html2pdf().set({
        margin: [10, 12, 10, 12], filename: `Bitácora ${maestro.nombre}.pdf`, image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      }).from(`<div class="bt-doc" style="width:100%"><style>${css}</style>${cuerpo}</div>`, "string").outputPdf("blob");
      const archivo = new Blob([blob], { type: "application/pdf" });
      // Nombre del archivo sin tildes (algunos navegadores las cambian al descargar)
      const nombre = `Bitacora - ${maestro.nombre}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s.-]/g, "") + ".pdf";
      setPdf({ url: URL.createObjectURL(archivo), nombre });
    } catch (e) { avisar("No se pudo generar el PDF: " + e.message, "error"); }
    setGenerando(false);
  };
  const imprimir = () => {
    if (!guardadas.length) { avisar("Todavía no hay páginas guardadas", "error"); return; }
    const { css, cuerpo } = documentoBitacora(guardadas, maestro.nombre, secciones);
    const w = window.open("", "_blank");
    if (!w) { avisar("Permite las ventanas emergentes para imprimir, o usa “Descargar PDF”", "error"); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bitácora ${esc(maestro.nombre)}</title><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap" rel="stylesheet"><style>@page{size:letter;margin:12mm}${css}</style></head><body class="bt-doc">${cuerpo}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 700);
  };

  // ── Barra superior ──
  const barra = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
      {editable && <>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Fecha de la clase</label>
        <input type="date" value={fecha || ""} max={hoyISO()} onChange={(e) => ir(e.target.value)} style={{ ...input, width: 160 }} />
        {fecha !== hoyISO() && <button onClick={() => ir(hoyISO())} style={btnO}><Plus size={13} />Hoy</button>}
      </>}
      <span style={{ flex: 1 }} />
      <button onClick={descargarPDF} disabled={generando} style={{ ...btn(), opacity: generando ? 0.6 : 1 }}><Download size={14} />{generando ? "Generando…" : "Descargar PDF"}</button>
      <button onClick={imprimir} style={btnO}><Printer size={14} />Imprimir</button>
    </div>
  );

  // ── Sin páginas: portada ──
  if (!fecha) return (<div>
    <style>{ESTILOS}</style>
    {barra}
    <div style={{ maxWidth: 520, margin: "0 auto", background: "linear-gradient(135deg,#1E293B,#334155)", borderRadius: "6px 18px 18px 6px", padding: "48px 30px", textAlign: "center", color: "#fff", boxShadow: "inset 10px 0 0 #0F172A, 0 20px 40px rgba(15,23,42,.25)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 120, height: 120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={LOGO_SEEDS} alt="Seeds" style={{ width: 100, height: 100, objectFit: "contain" }} /></div>
      <div className="bt-titulo" style={{ color: "#FDBA74", fontSize: 44, marginTop: 18 }}>Bitácora de clases</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{maestro?.nombre}</div>
      <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 14 }}>{editable ? "Todavía no hay páginas. Elige la fecha de tu clase arriba para escribir la primera." : "Este docente todavía no ha escrito en su bitácora."}</div>
      {editable && <button onClick={() => ir(hoyISO())} style={{ ...btn(), marginTop: 18 }}><BookOpen size={15} />Escribir la página de hoy</button>}
    </div>
  </div>);

  // ── Página abierta ──
  const hojaIzq = (
    <div style={{ flex: escritorio ? "0 0 38%" : "none", background: "#FBF7EF", padding: "26px 22px", borderRight: escritorio ? "1px solid #E7DCC8" : "none", borderBottom: escritorio ? "none" : "1px solid #E7DCC8", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Bitácora · {maestro?.nombre}</div>
      <div className="bt-titulo" style={{ fontSize: 34, marginTop: 6 }}>{fechaTitulo(fecha)}</div>
      <div style={{ marginTop: 10 }}>
        {editable ? (
          <select value={borrador.seccion_id || ""} onChange={(e) => setBorrador({ ...borrador, seccion_id: e.target.value })} style={{ ...input, background: "#fff", cursor: "pointer" }}>
            <option value="">Grupo (opcional)</option>
            {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        ) : (borrador.seccion_id && <span style={{ fontSize: 13, fontWeight: 700, color: "#9A3412", background: "#FFEDD5", padding: "4px 10px", borderRadius: 20 }}>{grupo(borrador.seccion_id)}</span>)}
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 12 }}>{actual ? `Página ${paginas.findIndex((p) => p.fecha === fecha) + 1} de ${paginas.length}` : "Página nueva (sin guardar)"}{actual?.updated_at && ` · editada ${new Date(actual.updated_at).toLocaleDateString("es-HN")}`}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A3412", textTransform: "uppercase", letterSpacing: 0.5, margin: "20px 0 6px" }}>Índice</div>
      <div className="bt-indice" style={{ overflowY: "auto", maxHeight: escritorio ? 300 : 130, borderTop: "1px dashed #E7DCC8" }}>
        {[...paginas].reverse().map((p) => (
          <button key={p.id} onClick={() => ir(p.fecha)} style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%", padding: "6px 4px", border: "none", borderBottom: "1px dashed #E7DCC8", background: p.fecha === fecha ? "#FFEDD5" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ fontSize: 12, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo || textoPlano(p.contenido).slice(0, 40) || "Sin título"}</span>
            <span style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>{fechaCorta(p.fecha)}</span>
          </button>
        ))}
        {paginas.length === 0 && <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 0" }}>Aún no hay páginas guardadas.</div>}
      </div>
    </div>
  );
  const hojaDer = (
    <div className="bt-renglones" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
      <div style={{ padding: "18px 18px 0 60px" }}>
        {editable
          ? <input value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} placeholder="Título de la clase…" maxLength={120} className="bt-titulo" style={{ width: "100%", border: "none", background: "transparent", outline: "none", padding: 0 }} />
          : <div className="bt-titulo">{borrador.titulo || <span style={{ color: "#CBD5E1" }}>Sin título</span>}</div>}
      </div>
      {editable
        ? <>
            <BarraFormato editorRef={editorRef} onCambio={leerEditor} />
            <div ref={montarEditor} contentEditable suppressContentEditableWarning onInput={leerEditor} onBlur={leerEditor} data-placeholder="¿Qué hiciste hoy en clase? Temas, actividades, cómo respondieron los alumnos, tareas, pendientes…" className="bt-texto bt-renglones" style={{ flex: 1, minHeight: escritorio ? 400 : 340, outline: "none", width: "100%", boxSizing: "border-box", whiteSpace: "normal" }} />
          </>
        : (borrador.contenido ? <div className="bt-texto" style={{ flex: 1, minHeight: escritorio ? 440 : 300, whiteSpace: "normal" }} dangerouslySetInnerHTML={{ __html: borrador.contenido }} /> : <div className="bt-texto" style={{ flex: 1, minHeight: escritorio ? 440 : 300 }}><span style={{ color: "#94A3B8", fontStyle: "italic" }}>Página en blanco.</span></div>)}
      {editable && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,.85)", borderTop: "1px solid #E7DCC8", flexWrap: "wrap" }}>
        <button onClick={borrar} style={{ ...btnO, color: "#DC2626", borderColor: "#FECACA", padding: "6px 10px", fontSize: 12 }}><Trash2 size={13} />{actual ? "Borrar página" : "Limpiar"}</button>
        <button onClick={guardar} disabled={guardando || !cambios} style={{ ...btn(), opacity: guardando || !cambios ? 0.5 : 1 }}><Save size={14} />{guardando ? "Guardando…" : cambios ? "Guardar página" : "✓ Guardada"}</button>
      </div>}
    </div>
  );

  return (<div>
    <style>{ESTILOS}</style>
    {barra}
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {escritorio && <button onClick={() => ir(fechas[pos - 1], "atras")} disabled={pos <= 0} title="Página anterior" style={{ ...btnO, borderRadius: "50%", width: 42, height: 42, justifyContent: "center", padding: 0, opacity: pos <= 0 ? 0.3 : 1 }}><ChevronLeft size={20} /></button>}
      <div style={{ flex: 1, minWidth: 0, background: "#1E293B", borderRadius: 14, padding: escritorio ? 12 : 6, boxShadow: "0 24px 50px rgba(15,23,42,.25)" }}>
        <div key={`${fecha}-${giro}`} className={giro ? (dir === "atras" ? "bt-pasar-atras" : "bt-pasar") : ""} style={{ display: "flex", flexDirection: escritorio ? "row" : "column", borderRadius: 8, overflow: "hidden", boxShadow: escritorio ? "inset 0 0 0 1px #E7DCC8" : "none", background: "#FFFEF9", position: "relative" }}>
          {hojaIzq}
          {escritorio && <div style={{ width: 18, background: "linear-gradient(to right, rgba(0,0,0,.12), rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,0,0,.10))", flexShrink: 0 }} />}
          {hojaDer}
        </div>
      </div>
      {escritorio && <button onClick={() => ir(fechas[pos + 1], "adelante")} disabled={pos >= fechas.length - 1} title="Página siguiente" style={{ ...btnO, borderRadius: "50%", width: 42, height: 42, justifyContent: "center", padding: 0, opacity: pos >= fechas.length - 1 ? 0.3 : 1 }}><ChevronRight size={20} /></button>}
    </div>
    {!escritorio && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
      <button onClick={() => ir(fechas[pos - 1], "atras")} disabled={pos <= 0} style={{ ...btnO, opacity: pos <= 0 ? 0.4 : 1 }}><ChevronLeft size={16} />Anterior</button>
      <button onClick={() => ir(fechas[pos + 1], "adelante")} disabled={pos >= fechas.length - 1} style={{ ...btnO, opacity: pos >= fechas.length - 1 ? 0.4 : 1 }}>Siguiente<ChevronRight size={16} /></button>
    </div>}

    {pdf && <div onClick={() => { setTimeout(() => URL.revokeObjectURL(pdf.url), 60000); setPdf(null); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ fontSize: 38 }}>📖</div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", margin: "8px 0 4px" }}>Tu bitácora está lista</h3>
        <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px" }}>{pdf.nombre}</p>
        <a href={pdf.url} download={pdf.nombre} style={{ ...btn(), width: "100%", justifyContent: "center", boxSizing: "border-box", padding: "12px" }}><Download size={16} />Guardar PDF</a>
        <a href={pdf.url} target="_blank" rel="noopener" style={{ ...btnO, width: "100%", justifyContent: "center", boxSizing: "border-box", marginTop: 8 }}><Eye size={14} />Abrir PDF</a>
        <button onClick={() => setPdf(null)} style={{ marginTop: 10, background: "none", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cerrar</button>
      </div>
    </div>}
  </div>);
}

// ════════════════════════════════════════════════════════════
//  ADMINISTRACIÓN: bitácoras de todos los docentes
// ════════════════════════════════════════════════════════════
export function AdminBitacoras({ data, showToast }) {
  const maestros = [...data.maestros].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const [mid, setMid] = useState(maestros[0]?.id || "");
  const [conteo, setConteo] = useState({});
  useEffect(() => { (async () => {
    const { data: d, error } = await supabase.from("bitacora").select("maestro_id,fecha").order("fecha", { ascending: false }).limit(5000);
    if (error) return;
    const c = {};
    (d || []).forEach((r) => { if (!c[r.maestro_id]) c[r.maestro_id] = { n: 0, ultima: r.fecha }; c[r.maestro_id].n++; });
    setConteo(c);
  })(); }, []);
  const maestro = data.maestros.find((m) => m.id === mid);
  const secciones = data.secciones.filter((s) => (maestro?.secciones_ids || []).includes(s.id)).concat(data.secciones.filter((s) => !(maestro?.secciones_ids || []).includes(s.id)));
  return (<div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      {maestros.map((m) => { const c = conteo[m.id]; const on = m.id === mid; return (
        <button key={m.id} onClick={() => setMid(m.id)} style={{ ...btnO, borderColor: on ? NAR : "#E2E8F0", background: on ? "#FFF7ED" : "#fff", color: on ? "#9A3412" : "#475569", fontWeight: on ? 700 : 500, flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "8px 12px" }}>
          <span>📖 {m.nombre}</span>
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>{c ? `${c.n} ${c.n === 1 ? "página" : "páginas"} · última ${fechaCorta(c.ultima)}` : "Sin páginas"}</span>
        </button>
      ); })}
    </div>
    {maestro ? <Bitacora maestro={maestro} secciones={secciones} editable={false} avisar={showToast} esAdmin /> : <div style={card}>No hay maestros registrados.</div>}
  </div>);
}
