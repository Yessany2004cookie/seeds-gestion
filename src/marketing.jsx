// ════════════════════════════════════════════════════════════
// MARKETING RELACIONAL
//
// Acceso propio (rol "marketing" en perfiles) para quien lleva la relación
// con las familias. Solo ve:
//  - Alumnos dados de baja y su encuesta de deserción (enviarla por
//    WhatsApp y ver lo que respondió el padre).
//  - Encuestas de satisfacción a toda la escuela: se crea una encuesta,
//    el sistema hace un enlace por familia con alumnos activos y se manda
//    por WhatsApp. El padre la abre sin sesión: ?satisfaccion=<token>.
// Nada de cobros, finanzas ni contabilidad (lo asegura la base de datos:
// supabase/marketing_relacional.sql). Administración ve lo mismo en
// Escuela y alumnado → Marketing relacional.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SEEDS } from "./logo";
import { BarraDescargas } from "./documentoFormal";
import { useMarca } from "./marca";
import { SelectorFondo } from "./fondo";
import { EncuestasDesercion, useEncuestas, reporteMatricula, linkWhatsApp } from "./desercion";
import { DocenteApp } from "./docentes";
import { LogOut, RefreshCw, GraduationCap, UserMinus, Smile, Plus, X } from "lucide-react";
import "./resumenMes.css";
import "./desercion.css";
import "./marketing.css";

// ── Preguntas que se pueden usar en la encuesta de satisfacción ──
// tipo: estrellas (1 a 5) · nps (0 a 10) · opcion (una de varias) · abierta (texto)
export const PREGUNTAS_BASE = [
  { id: "general", tipo: "estrellas", texto: "¿Qué tan satisfecho está, en general, con Seeds English?", obligatoria: true },
  { id: "docentes", tipo: "estrellas", texto: "Trato y atención de los maestros" },
  { id: "comunicacion", tipo: "estrellas", texto: "Comunicación de la escuela con los padres" },
  { id: "administracion", tipo: "estrellas", texto: "Atención en administración (secretaría y pagos)" },
  { id: "instalaciones", tipo: "estrellas", texto: "Limpieza, seguridad e instalaciones" },
  { id: "actividades", tipo: "estrellas", texto: "Actividades y eventos de la escuela" },
  { id: "recomendaria", tipo: "nps", texto: "Del 0 al 10, ¿qué tanto recomendaría Seeds a otra familia?" },
  { id: "continuara", tipo: "opcion", texto: "¿Piensa inscribir a su hijo(a) el próximo año?", opciones: ["Sí", "No", "Aún no sé"] },
  { id: "medio", tipo: "opcion", texto: "¿Por qué medio prefiere recibir avisos?", opciones: ["WhatsApp", "Llamada", "Correo", "Agenda del alumno"] },
  { id: "gusta", tipo: "abierta", texto: "¿Qué es lo que más le gusta de la escuela?" },
  { id: "mejorar", tipo: "abierta", texto: "¿Qué deberíamos mejorar?" },
  { id: "comentario", tipo: "abierta", texto: "¿Algún comentario o sugerencia adicional?" },
];
const TIPOS = { estrellas: "Estrellas (1 a 5)", nps: "Del 0 al 10", opcion: "Opciones", abierta: "Respuesta abierta" };

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const prom = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
const fechaC = (f) => (f ? new Date(f).toLocaleDateString("es-HN", { day: "numeric", month: "short" }) : "—");
const saludo = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"; };
export const enlaceSatisfaccion = (token) => `${window.location.origin}/?satisfaccion=${token}`;
const mensajeSatisfaccion = (padre, token) =>
  `${saludo()}${padre ? ", " + padre.split(" ")[0] : ""}. 🌱\n\n` +
  `En Seeds English queremos seguir mejorando para su familia. ¿Nos regala 2 minutos para contarnos cómo le ha parecido el servicio?\n\n` +
  `${enlaceSatisfaccion(token)}\n\n¡Muchas gracias por su confianza!`;

// NPS: % promotores (9-10) − % detractores (0-6)
const nps = (xs) => (xs.length ? Math.round(pct(xs.filter((x) => x >= 9).length, xs.length) - pct(xs.filter((x) => x <= 6).length, xs.length)) : null);

// Resumen de una pregunta a partir de las respuestas
function resumenPregunta(p, resp) {
  const vals = resp.map((r) => r.respuestas?.[p.id]).filter((v) => v !== undefined && v !== null && v !== "");
  if (p.tipo === "estrellas") return { n: vals.length, prom: prom(vals.map(Number)), dist: [5, 4, 3, 2, 1].map((k) => [k, vals.filter((v) => Number(v) === k).length]) };
  if (p.tipo === "nps") { const xs = vals.map(Number); return { n: xs.length, prom: prom(xs), nps: nps(xs), prom9: xs.filter((x) => x >= 9).length, pas: xs.filter((x) => x >= 7 && x <= 8).length, det: xs.filter((x) => x <= 6).length }; }
  if (p.tipo === "opcion") return { n: vals.length, dist: (p.opciones || []).map((o) => [o, vals.filter((v) => v === o).length]) };
  return { n: vals.length, textos: vals };
}

// ── Datos de la encuesta de satisfacción ──
function useSatisfaccion() {
  const [campanas, setCampanas] = useState(null); // null = cargando, false = falta activar en la BD
  const [filas, setFilas] = useState([]);
  const [sel, setSel] = useState("");
  const cargar = useCallback(async (elegir) => {
    const { data, error } = await supabase.from("satisfaccion_campanas").select("*").order("created_at", { ascending: false });
    if (error) { setCampanas(false); return; }
    setCampanas(data || []);
    setSel((s) => elegir || (data || []).some((c) => c.id === s) ? elegir || s : data?.[0]?.id || "");
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const cargarFilas = useCallback(async () => {
    if (!sel) { setFilas([]); return; }
    const { data } = await supabase.from("satisfaccion_respuestas").select("*").eq("campana_id", sel).order("created_at");
    setFilas(data || []);
  }, [sel]);
  useEffect(() => { cargarFilas(); }, [cargarFilas]);
  return { campanas, filas, sel, setSel, cargar, cargarFilas };
}

// ── Panel principal (lo usan Marketing y administración) ──
export function MarketingPanel({ data, showToast }) {
  const [tab, setTab] = useState("satisfaccion");
  const encuestas = useEncuestas();
  const bajas = data.alumnos.filter((a) => a.estado === "inactivo").length;
  return (
    <div className="mk">
      <div className="mk-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "satisfaccion"} className={tab === "satisfaccion" ? "on" : ""} onClick={() => setTab("satisfaccion")}><Smile size={16} />Satisfacción de la escuela</button>
        <button role="tab" aria-selected={tab === "bajas"} className={tab === "bajas" ? "on" : ""} onClick={() => setTab("bajas")}><UserMinus size={16} />Alumnos dados de baja <span className="mk-cont">{bajas}</span></button>
      </div>
      {tab === "bajas" ? (
        <>
          <div className="rm dm">
            <div className="rm-cab">
              <div><div className="rm-eti">Deserción</div><div className="rm-tit">Encuesta a las familias que se fueron</div></div>
              <BarraDescargas compacto showToast={showToast} reporte={() => reporteMatricula(data, "", "todo", encuestas.lista || [])} />
            </div>
            <div className="rm-cuerpo"><p className="dm-nota" style={{ marginTop: 0 }}>Cada vez que administración da de baja a un alumno se crea su encuesta. Toque <b>Enviar</b> para mandarla al padre por WhatsApp; su respuesta aparece aquí.</p></div>
          </div>
          <EncuestasDesercion data={data} filterSec="" encuestas={encuestas} abiertoInicial />
        </>
      ) : <Satisfaccion data={data} showToast={showToast} />}
    </div>
  );
}

function Satisfaccion({ data, showToast }) {
  const s = useSatisfaccion();
  const [nueva, setNueva] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [sec, setSec] = useState("");
  const [buscar, setBuscar] = useState("");
  const [abrirTextos, setAbrirTextos] = useState({});
  const camp = (s.campanas || []).find((c) => c.id === s.sel);
  const padre = (id) => data.padres.find((p) => p.id === id);

  if (s.campanas === null) return <p className="dm-nota">Cargando…</p>;
  if (s.campanas === false) return <div className="rm dm"><div className="rm-cuerpo"><div className="rm-frase ambar">Falta activar las encuestas de satisfacción en la base de datos (archivo supabase/marketing_relacional.sql).</div></div></div>;

  const resp = s.filas.filter((f) => f.respondida_en);
  const enviadas = s.filas.filter((f) => f.enviada_en || f.respondida_en);
  const pregs = camp?.preguntas || [];
  const general = pregs.find((p) => p.tipo === "estrellas");
  const recom = pregs.find((p) => p.tipo === "nps");
  const rG = general && resumenPregunta(general, resp);
  const rN = recom && resumenPregunta(recom, resp);
  const visibles = s.filas.filter((f) => {
    if (filtro === "sin" && (f.enviada_en || f.respondida_en)) return false;
    if (filtro === "enviada" && (!f.enviada_en || f.respondida_en)) return false;
    if (filtro === "resp" && !f.respondida_en) return false;
    if (sec && !(f.secciones || "").split(", ").includes(sec)) return false;
    if (buscar) { const q = buscar.toLowerCase(); if (!((padre(f.padre_id)?.nombre || "") + " " + (f.alumnos || "")).toLowerCase().includes(q)) return false; }
    return true;
  });
  const seccionesNombres = [...new Set(s.filas.flatMap((f) => (f.secciones || "").split(", ").filter(Boolean)))].sort();

  const enviar = async (f) => {
    await supabase.from("satisfaccion_respuestas").update({ enviada_en: new Date().toISOString() }).eq("id", f.id);
    s.cargarFilas();
  };
  const cerrar = async () => {
    if (!confirm(camp.cerrada ? "¿Volver a abrir esta encuesta? Las familias podrán responder de nuevo." : "¿Cerrar esta encuesta? Las familias que no han respondido ya no podrán hacerlo.")) return;
    const { error } = await supabase.from("satisfaccion_campanas").update({ cerrada: !camp.cerrada }).eq("id", camp.id);
    if (error) showToast("No se pudo: " + error.message, "error"); else { showToast(camp.cerrada ? "Encuesta abierta" : "Encuesta cerrada"); s.cargar(camp.id); }
  };

  return (
    <>
      <div className="rm dm">
        <div className="rm-cab">
          <div>
            <div className="rm-eti">Encuesta de satisfacción {camp?.cerrada && "· cerrada"}{camp?.anonima && " · anónima"}</div>
            {s.campanas.length > 1 ? (
              <select className="mk-sel-tit" value={s.sel} onChange={(e) => s.setSel(e.target.value)} aria-label="Encuesta">
                {s.campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            ) : <div className="rm-tit">{camp?.nombre || "Todavía no hay encuestas"}</div>}
          </div>
          <div className="dm-cab-der">
            {camp && <BarraDescargas compacto showToast={showToast} reporte={() => reporteSatisfaccion(camp, s.filas, data)} />}
            {camp && <button className="dm-btn sec" onClick={cerrar}>{camp.cerrada ? "Volver a abrir" : "Cerrar encuesta"}</button>}
            <button className="dm-btn nar" onClick={() => setNueva(true)}><Plus size={15} />Nueva encuesta</button>
          </div>
        </div>
        {!camp ? (
          <div className="rm-cuerpo"><p className="dm-nota" style={{ marginTop: 0 }}>Cree la primera encuesta con <b>Nueva encuesta</b>. Se hará un enlace para cada familia con alumnos activos y lo podrá mandar por WhatsApp.</p></div>
        ) : (
          <div className="rm-cuerpo">
            <div className="rm-fila mk-fila4">
              <div className="rm-k" style={{ "--rm-c": "var(--rm-azul)" }}><div className="rm-k-t">Familias</div><div className="rm-k-v">{s.filas.length}</div><div className="rm-k-s">{enviadas.length} ya recibieron el enlace</div></div>
              <div className="rm-k" style={{ "--rm-c": "var(--rm-verde)" }}><div className="rm-k-t">Respondieron</div><div className="rm-k-v">{resp.length} <span className="dm-pct">{pct(resp.length, s.filas.length)}%</span></div><div className="rm-k-s">{pct(resp.length, enviadas.length)}% de las que la recibieron</div></div>
              <div className="rm-k" style={{ "--rm-c": "var(--rm-naranja)" }}><div className="rm-k-t">Satisfacción general</div><div className="rm-k-v">{rG?.prom ?? "—"}<span className="dm-pct"> / 5</span></div><div className="rm-k-s">{rG?.prom ? "★".repeat(Math.round(rG.prom)) : "sin respuestas aún"}</div></div>
              {rN && <div className="rm-k" style={{ "--rm-c": rN.nps === null ? "var(--rm-suave)" : rN.nps >= 30 ? "var(--rm-verde)" : rN.nps >= 0 ? "var(--rm-ambar)" : "var(--rm-rojo)" }}><div className="rm-k-t">Recomendación (NPS)</div><div className="rm-k-v">{rN.nps ?? "—"}</div><div className="rm-k-s">{rN.n ? `${rN.prom9} recomiendan · ${rN.det} no` : "de −100 a 100"}</div></div>}
            </div>

            {resp.length > 0 && <>
              <div className="rm-grupo">Resultados por pregunta</div>
              <div className="mk-preguntas">
                {pregs.map((p) => { const r = resumenPregunta(p, resp); return (
                  <div key={p.id} className="mk-preg">
                    <div className="mk-preg-t">{p.texto}<span>{r.n} {r.n === 1 ? "respuesta" : "respuestas"}</span></div>
                    {p.tipo === "estrellas" && <div className="mk-est"><b>{r.prom ?? "—"}</b><span className="mk-star">★</span><div className="mk-dist">{r.dist.map(([k, n]) => <div key={k}><span>{k}★</span><div className="dm-barra"><i style={{ width: pct(n, r.n) + "%" }} /></div><em>{n}</em></div>)}</div></div>}
                    {p.tipo === "nps" && <div className="mk-nps"><div><b>{r.nps ?? "—"}</b> NPS</div><div className="mk-nps-b"><i className="v" style={{ flex: r.prom9 }} /><i className="a" style={{ flex: r.pas }} /><i className="r" style={{ flex: r.det }} /></div><div className="mk-nps-l"><span className="v">{r.prom9} recomiendan (9-10)</span><span className="a">{r.pas} neutrales (7-8)</span><span className="r">{r.det} no recomiendan (0-6)</span></div></div>}
                    {p.tipo === "opcion" && <div className="mk-dist op">{r.dist.map(([o, n]) => <div key={o}><span>{o}</span><div className="dm-barra"><i style={{ width: pct(n, r.n) + "%" }} /></div><em>{n}</em></div>)}</div>}
                    {p.tipo === "abierta" && (r.textos.length ? <>
                      <ul className="mk-textos">{(abrirTextos[p.id] ? r.textos : r.textos.slice(0, 3)).map((t, i) => <li key={i}>“{t}”</li>)}</ul>
                      {r.textos.length > 3 && <button className="rm-link" onClick={() => setAbrirTextos({ ...abrirTextos, [p.id]: !abrirTextos[p.id] })}>{abrirTextos[p.id] ? "Ver menos" : `Ver las ${r.textos.length}`}</button>}
                    </> : <p className="dm-nota">Sin comentarios aún.</p>)}
                  </div>
                ); })}
              </div>
            </>}

            <div className="rm-grupo" style={{ marginTop: 18 }}>Enviar a las familias</div>
            <div className="mk-filtros">
              {[["todas", "Todas", s.filas.length], ["sin", "Sin enviar", s.filas.filter((f) => !f.enviada_en && !f.respondida_en).length], ["enviada", "Enviada, sin respuesta", s.filas.filter((f) => f.enviada_en && !f.respondida_en).length], ["resp", "Respondieron", resp.length]].map(([v, t, n]) => (
                <button key={v} className={filtro === v ? "on" : ""} onClick={() => setFiltro(v)}>{t} <span>{n}</span></button>
              ))}
              <select value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Sección"><option value="">Todas las secciones</option>{seccionesNombres.map((n) => <option key={n}>{n}</option>)}</select>
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar familia o alumno" />
            </div>
            <div className="dm-tabla-env">
              <table className="dm-tabla">
                <thead><tr><th>Familia</th><th>Alumnos</th><th>Estado</th><th className="n">General</th><th></th></tr></thead>
                <tbody>
                  {visibles.map((f) => { const p = padre(f.padre_id); const g = general && f.respuestas?.[general.id]; return (
                    <tr key={f.id}>
                      <td><b>{p?.nombre || "—"}</b>{p?.telefono && <div className="dm-sub">{p.telefono}</div>}</td>
                      <td>{f.alumnos}<div className="dm-sub">{f.secciones}</div></td>
                      <td>{f.respondida_en ? <span className="mk-ok">Respondió {fechaC(f.respondida_en)}</span> : f.enviada_en ? <span className="dm-pend">Enviada {fechaC(f.enviada_en)}</span> : <span className="dm-sub">Sin enviar</span>}</td>
                      <td className="n">{camp.anonima ? (f.respondida_en ? "✓" : "—") : g ? "★".repeat(g) : "—"}</td>
                      <td>{!f.respondida_en && !camp.cerrada && (p?.telefono
                        ? <a className="dm-btn wa chico" href={linkWhatsApp(p.telefono, mensajeSatisfaccion(p.nombre, f.token))} target="_blank" rel="noreferrer" onClick={() => enviar(f)}>{f.enviada_en ? "Reenviar" : "Enviar"}</a>
                        : <button className="dm-btn sec chico" onClick={async () => { try { await navigator.clipboard.writeText(mensajeSatisfaccion(p?.nombre, f.token)); await enviar(f); showToast("✓ Mensaje copiado (la familia no tiene teléfono guardado)"); } catch { /* sin portapapeles */ } }}>Copiar enlace</button>)}</td>
                    </tr>
                  ); })}
                  {visibles.length === 0 && <tr><td colSpan={5} className="dm-sub">No hay familias con ese filtro.</td></tr>}
                </tbody>
              </table>
            </div>
            {camp.anonima && <p className="dm-nota">Encuesta anónima: se ve quién respondió, pero no qué respondió cada familia.</p>}
          </div>
        )}
      </div>
      {nueva && <NuevaEncuesta onCerrar={() => setNueva(false)} showToast={showToast} onCreada={(id) => { setNueva(false); s.cargar(id); }} />}
    </>
  );
}

// ── Ventana: crear una encuesta nueva ──
function NuevaEncuesta({ onCerrar, onCreada, showToast }) {
  const mes = new Date().toLocaleDateString("es-HN", { month: "long", year: "numeric" });
  const [nombre, setNombre] = useState("Satisfacción de las familias · " + mes);
  const [pregs, setPregs] = useState(PREGUNTAS_BASE.map((p) => ({ ...p, usar: true })));
  const [anonima, setAnonima] = useState(false);
  const [nuevaP, setNuevaP] = useState({ texto: "", tipo: "estrellas", opciones: "" });
  const [ocupado, setOcupado] = useState(false);
  const agregar = () => {
    if (!nuevaP.texto.trim()) return;
    const ops = nuevaP.opciones.split(",").map((x) => x.trim()).filter(Boolean);
    if (nuevaP.tipo === "opcion" && ops.length < 2) { showToast("Escriba al menos 2 opciones separadas por coma", "error"); return; }
    setPregs([...pregs, { id: "p" + Date.now().toString(36), tipo: nuevaP.tipo, texto: nuevaP.texto.trim(), ...(nuevaP.tipo === "opcion" ? { opciones: ops } : {}), usar: true }]);
    setNuevaP({ texto: "", tipo: "estrellas", opciones: "" });
  };
  const crear = async () => {
    const elegidas = pregs.filter((p) => p.usar).map(({ usar, ...p }) => p);
    if (!elegidas.length) { showToast("Elija al menos una pregunta", "error"); return; }
    setOcupado(true);
    const { data, error } = await supabase.rpc("satisfaccion_crear", { p_nombre: nombre, p_preguntas: elegidas, p_anonima: anonima });
    setOcupado(false);
    if (error) showToast("No se pudo crear: " + error.message, "error");
    else { showToast("✓ Encuesta creada: ya puede enviarla a las familias"); onCreada(data); }
  };
  return (
    <div className="dm-velo" onClick={onCerrar}>
      <div className="dm-ventana mk-ventana" role="dialog" aria-modal="true" aria-label="Nueva encuesta" onClick={(e) => e.stopPropagation()}>
        <div className="dm-v-cab"><h3>Nueva encuesta de satisfacción</h3><button onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        <label className="mk-lab">Nombre de la encuesta</label>
        <input className="ep-input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        <label className="mk-lab">Preguntas <span>({pregs.filter((p) => p.usar).length} elegidas)</span></label>
        <div className="mk-lista">
          {pregs.map((p, i) => (
            <label key={p.id} className={"mk-item" + (p.usar ? " sel" : "")}>
              <input type="checkbox" checked={p.usar} onChange={() => setPregs(pregs.map((x, j) => (j === i ? { ...x, usar: !x.usar } : x)))} />
              <span>{p.texto}<em>{TIPOS[p.tipo]}{p.opciones ? ": " + p.opciones.join(" / ") : ""}</em></span>
            </label>
          ))}
        </div>
        <div className="mk-agregar">
          <input className="ep-input" placeholder="Agregar otra pregunta" value={nuevaP.texto} onChange={(e) => setNuevaP({ ...nuevaP, texto: e.target.value })} maxLength={200} />
          <div className="mk-agregar-f">
            <select value={nuevaP.tipo} onChange={(e) => setNuevaP({ ...nuevaP, tipo: e.target.value })}>{Object.entries(TIPOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            {nuevaP.tipo === "opcion" && <input className="ep-input" placeholder="Opciones separadas por coma" value={nuevaP.opciones} onChange={(e) => setNuevaP({ ...nuevaP, opciones: e.target.value })} />}
            <button className="dm-btn sec" onClick={agregar}><Plus size={14} />Agregar</button>
          </div>
        </div>
        <label className="mk-item mk-anon"><input type="checkbox" checked={anonima} onChange={() => setAnonima(!anonima)} /><span>Anónima<em>Se ve quién respondió, pero no qué respondió cada familia.</em></span></label>
        <div className="dm-acciones" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="dm-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="dm-btn nar" disabled={ocupado} onClick={crear}>{ocupado ? "Creando…" : "Crear y preparar envíos"}</button>
        </div>
        <p className="dm-nota">Se prepara un enlace para cada familia con alumnos activos. Las familias no reciben nada hasta que usted toque Enviar.</p>
      </div>
    </div>
  );
}

// ── Reporte para descargar (Excel y PDF, formato de reportes) ──
export function reporteSatisfaccion(camp, filas, data) {
  const resp = filas.filter((f) => f.respondida_en);
  const pregs = camp.preguntas || [];
  const padre = (id) => data.padres.find((p) => p.id === id);
  const enviadas = filas.filter((f) => f.enviada_en || f.respondida_en).length;
  const filasRes = [];
  pregs.forEach((p) => {
    const r = resumenPregunta(p, resp);
    if (p.tipo === "estrellas") filasRes.push({ c: [p.texto, r.n, r.prom != null ? r.prom.toFixed(1) + " / 5" : "—"] });
    else if (p.tipo === "nps") filasRes.push({ c: [p.texto, r.n, r.nps != null ? `NPS ${r.nps} · ${r.prom9} recomiendan, ${r.pas} neutrales, ${r.det} no` : "—"] });
    else if (p.tipo === "opcion") filasRes.push({ c: [p.texto, r.n, r.dist.map(([o, n]) => `${o}: ${n}`).join(" · ")] });
  });
  const hojas = [
    { nombre: "Resumen", titulo: "Resumen de la encuesta", sangria: false,
      columnas: [{ t: "Indicador" }, { t: "Valor", ent: true, ancho: 110 }],
      filas: [{ c: ["Familias con alumnos activos", filas.length] }, { c: ["Recibieron el enlace", enviadas] }, { c: ["Respondieron", resp.length] }, { tipo: "gran", c: ["% de respuesta", pct(resp.length, filas.length) + "%"] }] },
    { nombre: "Por pregunta", titulo: "Resultados por pregunta", sangria: false,
      columnas: [{ t: "Pregunta" }, { t: "Respuestas", ent: true, ancho: 90 }, { t: "Resultado" }],
      filas: filasRes.length ? filasRes : [{ c: ["Sin preguntas de calificación"] }] },
  ];
  const abiertas = pregs.filter((p) => p.tipo === "abierta");
  if (abiertas.length) hojas.push({ nombre: "Comentarios", titulo: "Lo que escribieron las familias", sangria: false,
    columnas: [{ t: "Pregunta" }, ...(camp.anonima ? [] : [{ t: "Familia" }]), { t: "Respuesta" }],
    filas: abiertas.flatMap((p) => resp.filter((f) => f.respuestas?.[p.id]).map((f) => ({ c: [p.texto, ...(camp.anonima ? [] : [padre(f.padre_id)?.nombre || ""]), f.respuestas[p.id]] }))) });
  if (!camp.anonima) hojas.push({ nombre: "Respuestas", titulo: "Respuestas por familia", sangria: false,
    columnas: [{ t: "Familia" }, { t: "Alumnos" }, { t: "Estado" }, ...pregs.map((p) => ({ t: p.texto, ...(p.tipo === "estrellas" || p.tipo === "nps" ? { ent: true, ancho: 80 } : {}) }))],
    filas: filas.map((f) => ({ c: [padre(f.padre_id)?.nombre || "", f.alumnos || "", f.respondida_en ? "Respondió" : f.enviada_en ? "Enviada, sin respuesta" : "Sin enviar", ...pregs.map((p) => f.respuestas?.[p.id] ?? "")] })) });
  return { titulo: camp.nombre, periodo: new Date(camp.created_at).toLocaleDateString("es-HN", { month: "long", year: "numeric" }), modulo: "Marketing relacional", moneda: false, hojas };
}

// ── App propia del rol Marketing relacional ──
export function MarketingApp({ session, perfil }) {
  const marca = useMarca();
  const [datos, setDatos] = useState(null);
  const [vistaDocente, setVistaDocente] = useState(false);
  const [toast, setToast] = useState(null);
  const avisar = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const cargar = useCallback(async () => {
    const [s, a, p] = await Promise.all([
      supabase.from("secciones").select("id,nombre").order("nombre"),
      supabase.from("alumnos").select("id,nombre,padre_id,seccion_id,estado,fecha_ingreso,fecha_baja").order("nombre"),
      supabase.from("padres").select("id,nombre,telefono"),
    ]);
    const err = s.error || a.error || p.error;
    if (err) { avisar("Error cargando datos: " + err.message, "error"); return; }
    setDatos({ secciones: s.data || [], alumnos: a.data || [], padres: p.data || [] });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (vistaDocente) return <DocenteApp session={session} perfil={perfil} onVolver={() => setVistaDocente(false)} />;
  return (
    <div className="mk-app">
      <header className="vidrio-barra mk-barra">
        <div className="mk-marca">
          <img src={marca.logoSrc} alt="" />
          <div><b>{marca.nombreO("Seeds English")}</b><span>Marketing relacional</span></div>
        </div>
        <div className="mk-barra-der">
          {perfil.maestro_id && <button className="dm-btn sec chico" onClick={() => setVistaDocente(true)}><GraduationCap size={14} />Portal docente</button>}
          <SelectorFondo />
          <button className="dm-btn sec chico" onClick={cargar} title="Actualizar" aria-label="Actualizar"><RefreshCw size={14} /></button>
          <div className="hide-mobile mk-quien">{session.user.email}</div>
          <button className="dm-btn sec chico" onClick={() => supabase.auth.signOut()}><LogOut size={14} />Salir</button>
        </div>
      </header>
      <main className="mk-main">{datos ? <MarketingPanel data={datos} showToast={avisar} /> : <p className="dm-nota">Cargando…</p>}</main>
      {toast && <div className={"mk-toast " + toast.type}>{toast.msg}<button onClick={() => setToast(null)} aria-label="Cerrar"><X size={14} /></button></div>}
    </div>
  );
}

// ── Página pública que abre el padre ──
export function SatisfaccionPublica({ token }) {
  const [info, setInfo] = useState(undefined);
  const [r, setR] = useState({});
  const [estado, setEstado] = useState("");
  useEffect(() => {
    document.title = "Encuesta · Seeds English";
    supabase.rpc("satisfaccion_ver", { p_token: token }).then(({ data, error }) => setInfo(error ? null : data));
  }, [token]);
  const pregs = useMemo(() => info?.preguntas || [], [info]);
  const enviar = async (ev) => {
    ev.preventDefault();
    if (pregs.some((p) => p.obligatoria && (r[p.id] === undefined || r[p.id] === ""))) { setEstado("falta"); return; }
    setEstado("enviando");
    const limpio = {}; pregs.forEach((p) => { const v = r[p.id]; if (v !== undefined && v !== "") limpio[p.id] = typeof v === "string" ? v.trim().slice(0, 1500) : v; });
    const { data, error } = await supabase.rpc("satisfaccion_responder", { p_token: token, p_respuestas: limpio });
    setEstado(error ? "error" : data ? "listo" : "ya");
  };
  let cuerpo;
  if (info === undefined) cuerpo = <p className="ep-txt">Cargando…</p>;
  else if (!info) cuerpo = <p className="ep-txt">Este enlace no es válido. Si cree que es un error, escríbanos por WhatsApp.</p>;
  else if (info.respondida || estado === "listo" || estado === "ya") cuerpo = <div className="ep-fin"><div className="ep-ok">✓</div><h2>¡Muchas gracias!</h2><p className="ep-txt">Recibimos su respuesta. Su opinión nos ayuda a seguir mejorando para su familia.</p></div>;
  else if (info.cerrada) cuerpo = <p className="ep-txt">Esta encuesta ya se cerró. ¡Gracias por su interés!</p>;
  else cuerpo = (
    <form onSubmit={enviar}>
      <h2>{info.padre ? `${info.padre}, ¿cómo le ha parecido Seeds?` : "¿Cómo le ha parecido Seeds?"}</h2>
      <p className="ep-txt">{info.alumnos ? <>Queremos conocer su opinión como familia de <b>{info.alumnos}</b>. </> : null}Le toma unos 2 minutos.{info.anonima ? " Sus respuestas son anónimas." : " Sus respuestas solo las ve el equipo de la escuela."}</p>
      {pregs.map((p) => (
        <fieldset key={p.id} className="ep-campo">
          <legend>{p.texto}{p.obligatoria ? " *" : ""}</legend>
          {p.tipo === "estrellas" && <div className="ep-estrellas">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-label={n + " de 5"} className={n <= (r[p.id] || 0) ? "on" : ""} onClick={() => setR({ ...r, [p.id]: n })}>★</button>)}</div>}
          {p.tipo === "nps" && <><div className="mk-escala">{Array.from({ length: 11 }, (_, n) => <button type="button" key={n} className={r[p.id] === n ? "on" : ""} onClick={() => setR({ ...r, [p.id]: n })}>{n}</button>)}</div><div className="mk-escala-l"><span>Nada probable</span><span>Muy probable</span></div></>}
          {p.tipo === "opcion" && <div className="ep-fila">{p.opciones.map((o) => <label key={o} className={"ep-op" + (r[p.id] === o ? " sel" : "")}><input type="radio" name={p.id} checked={r[p.id] === o} onChange={() => setR({ ...r, [p.id]: o })} />{o}</label>)}</div>}
          {p.tipo === "abierta" && <textarea className="ep-input" rows={3} maxLength={1500} value={r[p.id] || ""} onChange={(e) => setR({ ...r, [p.id]: e.target.value })} placeholder="Opcional" />}
        </fieldset>
      ))}
      {estado === "falta" && <p className="ep-err">Por favor responda las preguntas marcadas con *.</p>}
      {estado === "error" && <p className="ep-err">No se pudo enviar. Revise su internet e intente de nuevo.</p>}
      <button className="ep-enviar" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar respuesta"}</button>
    </form>
  );
  return (
    <div className="ep">
      <div className="ep-tarjeta">
        <div className="ep-marca"><img src={LOGO_SEEDS} alt="" /><div><b>Seeds English</b><span>Encuesta de satisfacción</span></div></div>
        {cuerpo}
      </div>
    </div>
  );
}
