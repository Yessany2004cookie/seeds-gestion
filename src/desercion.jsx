// ════════════════════════════════════════════════════════════
// MATRÍCULA → resumen por sección (matriculados, se sumaron, deserción)
// y encuesta al padre por cada deserción.
//
// Reglas de conteo:
//  - Matriculados: alumnos con estado "activo" hoy.
//  - Se sumaron: alumnos que entraron en el periodo elegido (fecha de
//    ingreso). En "Todo el curso" son los que entraron DESPUÉS del inicio
//    del grupo (más de 7 días después del primer alumno de la sección).
//  - Deserción: alumnos dados de baja (estado "inactivo"). En un mes, solo
//    los que se dieron de baja ese mes. % = bajas ÷ (activos + bajas).
//  - Los graduados no cuentan como deserción.
//
// Cada baja crea una encuesta (lo hace la base de datos, ver
// supabase/desercion_encuestas.sql) con un enlace que se manda al padre
// por WhatsApp. El padre la abre sin sesión: ?encuesta=<token>.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_SEEDS } from "./logo";
import { BarraDescargas } from "./documentoFormal";
import "./resumenMes.css";
import "./desercion.css";

const MESES_N = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTexto = (ym) => { const [y, m] = ym.split("-"); return `${MESES_N[Number(m) - 1]} ${y}`; };
const hoyYM = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const sumarDias = (iso, d) => { const f = new Date(iso + "T12:00:00"); f.setDate(f.getDate() + d); return f.toLocaleDateString("en-CA"); };

export const MOTIVOS = [
  "Costo / situación económica",
  "Horario no le funciona",
  "Cambio de domicilio",
  "Salud",
  "El alumno perdió el interés",
  "La clase era muy fácil o muy difícil",
  "La atención del maestro",
  "Se cambió a otra institución",
  "Otro",
];

// ── Enlace y mensaje para el padre ──
export const enlaceEncuesta = (token) => `${window.location.origin}/?encuesta=${token}`;
const telWa = (t) => { const n = String(t || "").replace(/\D/g, ""); return n ? (n.length === 8 ? "504" + n : n) : ""; };
const saludo = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"; };
export const mensajeEncuesta = (padre, alumno, token) =>
  `${saludo()}${padre ? ", " + padre.split(" ")[0] : ""}. 🌱\n\n` +
  `Lamentamos que ${alumno} ya no continúe con nosotros en Seeds English. ` +
  `Su opinión nos ayuda mucho a mejorar: ¿nos cuenta en menos de un minuto por qué fue?\n\n` +
  `${enlaceEncuesta(token)}\n\n¡Gracias por la confianza y las puertas siempre están abiertas!`;
export const linkWhatsApp = (tel, texto) => `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(texto)}`;

// ── Cálculo por sección ──
function contar(alumnos, periodo) {
  const inicio = {};
  alumnos.forEach((a) => { const k = a.seccion_id || "_"; if (a.fecha_ingreso && (!inicio[k] || a.fecha_ingreso < inicio[k])) inicio[k] = a.fecha_ingreso; });
  let activos = 0, sumados = 0, bajas = 0, bajasSinFecha = 0;
  alumnos.forEach((a) => {
    if (a.estado === "activo") activos++;
    const ing = a.fecha_ingreso || "";
    if (periodo === "todo") { const ini = inicio[a.seccion_id || "_"]; if (ini && a.seccion_id && ing > sumarDias(ini, 7)) sumados++; }
    else if (ing.slice(0, 7) === periodo) sumados++;
    if (a.estado === "inactivo") {
      if (periodo === "todo") { bajas++; if (!a.fecha_baja) bajasSinFecha++; }
      else if ((a.fecha_baja || "").slice(0, 7) === periodo) bajas++;
    }
  });
  return { activos, sumados, bajas, bajasSinFecha, pct: pct(bajas, activos + bajas) };
}

export function ResumenMatricula({ data, filterSec, encuestas, showToast }) {
  const [periodo, setPeriodo] = useState("todo");
  const meses = useMemo(() => {
    const s = new Set([hoyYM()]);
    data.alumnos.forEach((a) => { if (a.fecha_ingreso) s.add(a.fecha_ingreso.slice(0, 7)); if (a.fecha_baja) s.add(a.fecha_baja.slice(0, 7)); });
    return [...s].sort().reverse();
  }, [data.alumnos]);
  const enAlcance = data.alumnos.filter((a) => !filterSec || a.seccion_id === filterSec);
  const r = contar(enAlcance, periodo);
  const sec = data.secciones.find((s) => s.id === filterSec);
  const porSeccion = !filterSec
    ? data.secciones.map((s) => ({ s, ...contar(data.alumnos.filter((a) => a.seccion_id === s.id), periodo) })).filter((x) => x.activos + x.bajas + x.sumados > 0)
    : [];
  const enMes = periodo !== "todo";
  return (
    <div className="rm dm">
      <div className="rm-cab">
        <div>
          <div className="rm-eti">Matrícula {enMes ? "· " + mesTexto(periodo) : "· todo el curso"}</div>
          <div className="rm-tit">{sec ? sec.nombre.trim() : "Todas las secciones"}</div>
        </div>
        <div className="dm-cab-der">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
            <option value="todo">Todo el curso</option>
            {meses.map((m) => <option key={m} value={m}>{mesTexto(m)}</option>)}
          </select>
          <BarraDescargas compacto showToast={showToast} reporte={() => reporteMatricula(data, filterSec, periodo, encuestas?.lista || [])} />
        </div>
      </div>
      <div className="rm-cuerpo">
        <div className="rm-fila">
          <div className="rm-k" style={{ "--rm-c": "var(--rm-azul)" }}>
            <div className="rm-k-t">Matriculados</div>
            <div className="rm-k-v">{r.activos}</div>
            <div className="rm-k-s">alumnos activos hoy</div>
          </div>
          <div className="rm-k" style={{ "--rm-c": "var(--rm-verde)" }}>
            <div className="rm-k-t">Se sumaron</div>
            <div className="rm-k-v">+{r.sumados}</div>
            <div className="rm-k-s">{enMes ? "entraron en " + MESES_N[Number(periodo.slice(5)) - 1] : "entraron después del inicio del grupo"}</div>
          </div>
          <div className="rm-k" style={{ "--rm-c": r.bajas ? "var(--rm-rojo)" : "var(--rm-suave)" }}>
            <div className="rm-k-t">Deserción</div>
            <div className="rm-k-v">{r.bajas} <span className="dm-pct">{r.pct}%</span></div>
            <div className="rm-k-s">{enMes ? "se dieron de baja en " + MESES_N[Number(periodo.slice(5)) - 1] : "alumnos dados de baja"}</div>
          </div>
        </div>
        {porSeccion.length > 0 && (
          <div className="dm-tabla-env">
            <table className="dm-tabla">
              <thead><tr><th>Sección</th><th className="n">Matriculados</th><th className="n">Se sumaron</th><th className="n">Deserción</th><th className="n">%</th></tr></thead>
              <tbody>
                {porSeccion.map(({ s, activos, sumados, bajas, pct: p }) => (
                  <tr key={s.id}><td>{s.nombre.trim()}</td><td className="n">{activos}</td><td className="n verde">{sumados ? "+" + sumados : "—"}</td><td className={"n" + (bajas ? " rojo" : "")}>{bajas || "—"}</td><td className={"n" + (p >= 20 ? " rojo" : "")}>{bajas ? p + "%" : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {periodo === "todo" && r.bajasSinFecha > 0 && (
          <div className="rm-pie"><span>{r.bajasSinFecha} de las bajas son anteriores a este registro (no tienen fecha ni encuesta). Desde hoy, cada baja guarda su fecha y crea su encuesta.</span></div>
        )}
      </div>
    </div>
  );
}

// ── Reporte para descargar (Excel y PDF, mismo formato que los reportes) ──
const VOLV = { si: "Sí", tal_vez: "Tal vez", no: "No" };
const fechaC = (f) => (f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
export function reporteMatricula(data, filterSec, periodo, lista) {
  const sec = data.secciones.find((s) => s.id === filterSec);
  const secs = sec ? [sec] : data.secciones;
  const filas = secs.map((s) => { const r = contar(data.alumnos.filter((a) => a.seccion_id === s.id), periodo); return { s, r }; }).filter((x) => sec || x.r.activos + x.r.bajas + x.r.sumados > 0);
  const tot = contar(data.alumnos.filter((a) => !filterSec || a.seccion_id === filterSec), periodo);
  const enMes = periodo !== "todo";
  const enPeriodo = (a) => a.estado === "inactivo" && (!enMes || (a.fecha_baja || "").slice(0, 7) === periodo) && (!filterSec || a.seccion_id === filterSec);
  const bajas = data.alumnos.filter(enPeriodo).sort((a, b) => (b.fecha_baja || "").localeCompare(a.fecha_baja || ""));
  const encDe = (id) => lista.find((e) => e.alumno_id === id);
  const resp = lista.filter((e) => e.respondida_en && bajas.some((a) => a.id === e.alumno_id));
  const conteo = {}; resp.forEach((e) => { conteo[e.motivo] = (conteo[e.motivo] || 0) + 1; });
  const hojas = [
    { nombre: "Matrícula por sección", titulo: "Matrícula y deserción por sección", sangria: false,
      columnas: [{ t: "Sección" }, { t: "Matriculados", ent: true, ancho: 100 }, { t: "Se sumaron", ent: true, ancho: 100 }, { t: "Deserción", ent: true, ancho: 100 }, { t: "% deserción", pct: true, ancho: 100 }],
      filas: [...filas.map(({ s, r }) => ({ c: [s.nombre.trim(), r.activos, r.sumados, r.bajas, r.pct] })),
        ...(filas.length > 1 ? [{ tipo: "gran", c: ["Total", tot.activos, tot.sumados, tot.bajas, tot.pct] }] : [])],
      pie: "Matriculados: alumnos activos hoy. Se sumaron: " + (enMes ? "alumnos que entraron en el mes." : "alumnos que entraron después de la primera semana del grupo.") + " Deserción: alumnos dados de baja" + (enMes ? " en el mes." : ".") + " % = deserción ÷ (matriculados + deserción). Los graduados no cuentan." },
    { nombre: "Bajas y encuestas", titulo: "Alumnos dados de baja y respuesta del padre", sangria: false,
      columnas: [{ t: "Alumno" }, { t: "Padre" }, { t: "Sección" }, { t: "Fecha de baja", ancho: 80 }, { t: "Motivo" }, { t: "Satisf. (1-5)", ent: true, ancho: 70 }, { t: "¿Volvería?", ancho: 70 }, { t: "Comentario" }],
      filas: bajas.length ? bajas.map((a) => { const e = encDe(a.id); const p = data.padres.find((x) => x.id === a.padre_id); const s = data.secciones.find((x) => x.id === a.seccion_id);
        return { c: [a.nombre, p?.nombre || "", s?.nombre.trim() || "", fechaC(a.fecha_baja) || "Sin fecha", e?.respondida_en ? e.motivo : e ? (e.enviada_en ? "Encuesta enviada, sin respuesta" : "Encuesta sin enviar") : "Sin encuesta (baja anterior)", e?.satisfaccion ?? "", VOLV[e?.volveria] || "", e?.comentario || ""] }; })
        : [{ c: ["No hay bajas en este periodo"] }] },
  ];
  if (resp.length) hojas.push({ nombre: "Motivos", titulo: "Motivos de deserción (según los padres)", sangria: false,
    columnas: [{ t: "Motivo" }, { t: "Respuestas", ent: true, ancho: 100 }, { t: "% de respuestas", pct: true, ancho: 110 }],
    filas: [...Object.entries(conteo).sort((a, b) => b[1] - a[1]).map(([m, n]) => ({ c: [m, n, pct(n, resp.length)] })), { tipo: "gran", c: ["Total de respuestas", resp.length, 100] }] });
  return { titulo: "Matrícula y deserción" + (sec ? " · " + sec.nombre.trim() : ""), periodo: enMes ? mesTexto(periodo) : "Todo el curso", modulo: "Escuela y alumnado", moneda: false, hojas };
}

// ── Encuestas: carga desde la BD ──
export function useEncuestas() {
  const [lista, setLista] = useState(null); // null = cargando, false = falta activar en la BD
  const recargar = useCallback(async () => {
    const { data, error } = await supabase.from("encuestas_desercion").select("*").order("created_at", { ascending: false });
    setLista(error ? false : data || []);
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  return { lista, recargar };
}

export async function encuestaDeAlumno(alumnoId) {
  const { data } = await supabase.from("encuestas_desercion").select("*").eq("alumno_id", alumnoId).order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

export async function marcarEnviada(id) {
  await supabase.from("encuestas_desercion").update({ enviada_en: new Date().toISOString() }).eq("id", id);
}

// ── Ventana después de dar de baja: mandar la encuesta ──
export function EnviarEncuesta({ alumno, padre, encuesta, onCerrar, onEnviada }) {
  const texto = mensajeEncuesta(padre?.nombre, alumno.nombre, encuesta.token);
  const [copiado, setCopiado] = useState(false);
  const enviar = async () => { await marcarEnviada(encuesta.id); onEnviada && onEnviada(); };
  return (
    <div className="dm-velo" onClick={onCerrar}>
      <div className="dm-ventana" role="dialog" aria-modal="true" aria-label="Encuesta de deserción" onClick={(e) => e.stopPropagation()}>
        <div className="dm-v-cab"><h3>Encuesta para el padre</h3><button onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        <p className="dm-v-txt"><b>{alumno.nombre}</b> quedó dado de baja. Se creó una encuesta para que {padre?.nombre ? <b>{padre.nombre}</b> : "el padre"} nos diga por qué.</p>
        <pre className="dm-msg">{texto}</pre>
        <div className="dm-acciones">
          {telWa(padre?.telefono)
            ? <a className="dm-btn wa" href={linkWhatsApp(padre.telefono, texto)} target="_blank" rel="noreferrer" onClick={enviar}>Enviar por WhatsApp</a>
            : <span className="dm-nota">El padre no tiene teléfono guardado.</span>}
          <button className="dm-btn sec" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); await enviar(); } catch { /* sin portapapeles */ } }}>{copiado ? "Copiado ✓" : "Copiar mensaje"}</button>
          <button className="dm-btn sec" onClick={onCerrar}>Después</button>
        </div>
        <p className="dm-nota">La encuesta queda guardada en Matrícula → Encuestas de deserción, por si la quiere mandar después.</p>
      </div>
    </div>
  );
}

// ── Panel de encuestas (admin) ──
export function EncuestasDesercion({ data, filterSec, encuestas, abiertoInicial }) {
  const { lista, recargar } = encuestas;
  const [abierto, setAbierto] = useState(!!abiertoInicial);
  const [enviar, setEnviar] = useState(null);
  if (lista === null) return null;
  if (lista === false) {
    return <div className="rm dm"><div className="rm-cuerpo"><div className="rm-frase ambar">Falta activar las encuestas de deserción en la base de datos (archivo supabase/desercion_encuestas.sql).</div></div></div>;
  }
  const al = (id) => data.alumnos.find((a) => a.id === id);
  const visibles = lista.filter((e) => !filterSec || e.seccion_id === filterSec || al(e.alumno_id)?.seccion_id === filterSec);
  const resp = visibles.filter((e) => e.respondida_en);
  const pend = visibles.filter((e) => !e.respondida_en);
  const conteo = {};
  resp.forEach((e) => { conteo[e.motivo] = (conteo[e.motivo] || 0) + 1; });
  const ranking = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const fecha = (f) => (f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-HN", { day: "numeric", month: "short" }) : "—");
  const volv = { si: "Sí", tal_vez: "Tal vez", no: "No" };
  return (
    <div className="rm dm">
      <button className="rm-cab dm-cab-btn" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <div>
          <div className="rm-eti">Encuestas de deserción</div>
          <div className="rm-tit dm-tit-s">{resp.length} respondidas · {pend.length} sin responder</div>
        </div>
        <span className="rm-link">{abierto ? "Ocultar" : "Ver respuestas"}</span>
      </button>
      {abierto && (
        <div className="rm-cuerpo">
          {visibles.length === 0 && <p className="dm-nota">Todavía no hay bajas registradas con encuesta. Cuando se dé de baja a un alumno (✕ en la tabla) se creará una.</p>}
          {ranking.length > 0 && (
            <>
              <div className="rm-grupo">Motivos más comunes</div>
              <div className="dm-motivos">
                {ranking.map(([m, n]) => (
                  <div key={m} className="dm-motivo"><span>{m}</span><div className="dm-barra"><i style={{ width: pct(n, resp.length) + "%" }} /></div><b>{n}</b></div>
                ))}
              </div>
            </>
          )}
          {visibles.length > 0 && (
            <div className="dm-tabla-env">
              <table className="dm-tabla">
                <thead><tr><th>Alumno</th><th>Sección</th><th>Baja</th><th>Motivo</th><th className="n">Satisfacción</th><th>¿Volvería?</th><th>Comentario</th><th></th></tr></thead>
                <tbody>
                  {visibles.map((e) => {
                    const a = al(e.alumno_id); const s = data.secciones.find((x) => x.id === (e.seccion_id || a?.seccion_id)); const p = a && data.padres.find((x) => x.id === a.padre_id);
                    return (
                      <tr key={e.id}>
                        <td><b>{a?.nombre || "—"}</b>{p && <div className="dm-sub">{p.nombre}</div>}</td>
                        <td>{s?.nombre.trim() || "—"}</td>
                        <td>{fecha(e.fecha_baja)}</td>
                        <td>{e.respondida_en ? e.motivo : <span className="dm-pend">{e.enviada_en ? "Enviada " + fecha(e.enviada_en) : "Sin enviar"}</span>}</td>
                        <td className="n">{e.satisfaccion ? "★".repeat(e.satisfaccion) : "—"}</td>
                        <td>{volv[e.volveria] || "—"}</td>
                        <td className="dm-com">{e.comentario || "—"}</td>
                        <td>{!e.respondida_en && a && <button className="dm-btn sec chico" onClick={() => setEnviar({ e, a, p })}>{e.enviada_en ? "Reenviar" : "Enviar"}</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {enviar && <EnviarEncuesta alumno={enviar.a} padre={enviar.p} encuesta={enviar.e} onCerrar={() => setEnviar(null)} onEnviada={recargar} />}
    </div>
  );
}

// ── Página pública que abre el padre ──
export function EncuestaPublica({ token }) {
  const [info, setInfo] = useState(undefined);
  const [f, setF] = useState({ motivo: "", otro: "", satisfaccion: 0, volveria: "", comentario: "" });
  const [estado, setEstado] = useState("");
  useEffect(() => {
    document.title = "Encuesta · Seeds English";
    supabase.rpc("encuesta_ver", { p_token: token }).then(({ data, error }) => setInfo(error ? null : data));
  }, [token]);
  const enviar = async (ev) => {
    ev.preventDefault();
    if (!f.motivo || (f.motivo === "Otro" && !f.otro.trim())) { setEstado("falta"); return; }
    setEstado("enviando");
    const motivo = f.motivo === "Otro" ? "Otro: " + f.otro.trim() : f.motivo;
    const { data, error } = await supabase.rpc("encuesta_responder", { p_token: token, p_motivo: motivo, p_satisfaccion: f.satisfaccion || null, p_volveria: f.volveria || null, p_comentario: f.comentario });
    setEstado(error ? "error" : data ? "listo" : "ya");
  };
  let cuerpo;
  if (info === undefined) cuerpo = <p className="ep-txt">Cargando…</p>;
  else if (!info) cuerpo = <p className="ep-txt">Este enlace no es válido. Si cree que es un error, escríbanos por WhatsApp.</p>;
  else if (info.respondida || estado === "listo" || estado === "ya") cuerpo = (
    <div className="ep-fin"><div className="ep-ok">✓</div><h2>¡Muchas gracias!</h2><p className="ep-txt">Recibimos su respuesta. Nos ayuda mucho a mejorar. Las puertas de Seeds siempre están abiertas para {info.alumno.split(" ")[0]}.</p></div>
  );
  else cuerpo = (
    <form onSubmit={enviar}>
      <h2>¿Por qué {info.alumno.split(" ")[0]} dejó las clases?</h2>
      <p className="ep-txt">Lamentamos que <b>{info.alumno}</b>{info.seccion ? <> ({info.seccion.trim()})</> : null} ya no continúe con nosotros. Su respuesta es confidencial y solo la ve la administración.</p>
      <fieldset className="ep-campo">
        <legend>Motivo principal *</legend>
        <div className="ep-opciones">
          {MOTIVOS.map((m) => (
            <label key={m} className={"ep-op" + (f.motivo === m ? " sel" : "")}><input type="radio" name="motivo" value={m} checked={f.motivo === m} onChange={() => setF({ ...f, motivo: m })} />{m}</label>
          ))}
        </div>
        {f.motivo === "Otro" && <input className="ep-input" placeholder="Cuéntenos cuál" value={f.otro} onChange={(e) => setF({ ...f, otro: e.target.value })} maxLength={100} />}
      </fieldset>
      <fieldset className="ep-campo">
        <legend>¿Qué tan contento estaba con las clases?</legend>
        <div className="ep-estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} aria-label={n + " de 5"} className={n <= f.satisfaccion ? "on" : ""} onClick={() => setF({ ...f, satisfaccion: n })}>★</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="ep-campo">
        <legend>¿Lo volvería a inscribir más adelante?</legend>
        <div className="ep-fila">
          {[["si", "Sí"], ["tal_vez", "Tal vez"], ["no", "No"]].map(([v, t]) => (
            <label key={v} className={"ep-op" + (f.volveria === v ? " sel" : "")}><input type="radio" name="volveria" checked={f.volveria === v} onChange={() => setF({ ...f, volveria: v })} />{t}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="ep-campo">
        <legend>¿Algo más que nos quiera contar?</legend>
        <textarea className="ep-input" rows={3} maxLength={1500} value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} placeholder="Opcional" />
      </fieldset>
      {estado === "falta" && <p className="ep-err">Por favor elija el motivo principal.</p>}
      {estado === "error" && <p className="ep-err">No se pudo enviar. Revise su internet e intente de nuevo.</p>}
      <button className="ep-enviar" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar respuesta"}</button>
    </form>
  );
  return (
    <div className="ep">
      <div className="ep-tarjeta">
        <div className="ep-marca"><img src={LOGO_SEEDS} alt="" /><div><b>Seeds English</b><span>Encuesta breve</span></div></div>
        {cuerpo}
      </div>
    </div>
  );
}
