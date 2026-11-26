// ════════════════════════════════════════════════════════════
// MARKETING RELACIONAL → AVISOS Y BIENVENIDA
//
// Avisos: lo que Nayeli tiene pendiente al entrar.
//  - Alumnos nuevos (matriculados hace pocos días) sin mensaje de bienvenida.
//  - Bajas cuya encuesta de deserción todavía no se mandó.
//  - Encuesta general de satisfacción: toca cada 6 meses.
// Bienvenida: lista de alumnos nuevos con el botón para mandar el mensaje
// por WhatsApp. El texto y sus datos (link de matrícula, pago de la
// plataforma, uniforme, horario de llamadas) se editan aquí mismo y se
// guardan en marketing_ajustes (supabase/marketing_bienvenida.sql).
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { linkWhatsApp } from "./desercion";
import { UserPlus, UserMinus, Smile, Pencil } from "lucide-react";

export const DIAS_ENCUESTA_GENERAL = 182; // cada 6 meses

export const AJUSTES_BASE = {
  dias_nuevo: 15,
  link_matricula: "",
  pago_plataforma: "",
  uniforme: "",
  horario_llamada: "",
  extra: "",
  mensaje:
    "{saludo}, {padre}. 🌱\n\n¡Bienvenidos a Seeds English! Nos alegra mucho que {alumno} se una a {seccion}.\n\n" +
    "Para dejar todo listo:\n" +
    "✅ ¿Ya realizó el pago de la plataforma? {pago_plataforma}\n" +
    "👕 ¿Le ayudamos gestionando su uniforme? {uniforme}\n" +
    "📝 Le comparto el link de matrícula: {link_matricula}\n" +
    "📞 Si se le dificulta llenarlo, con gusto hacemos una llamada y lo llenamos juntos. {horario_llamada}\n" +
    "{extra}\n\n¡Cualquier duda estamos a la orden!",
};
const CAMPOS = [
  ["link_matricula", "Link de matrícula", "https://…"],
  ["pago_plataforma", "Pago de la plataforma", "Ej.: Son L 500, por transferencia a…"],
  ["uniforme", "Uniforme", "Ej.: Cuesta L 350, tallas 4 a 16, se recoge en recepción"],
  ["horario_llamada", "Horario para llamadas", "Ej.: Lunes a viernes de 2 a 5 PM"],
  ["extra", "Algo más (opcional)", "Ej.: Horario de clase, materiales, grupo de WhatsApp"],
];

const saludo = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"; };
const restarDias = (d) => new Date(Date.now() - d * 86400000).toLocaleDateString("en-CA");
const fechaC = (f) => (f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-HN", { day: "numeric", month: "short" }) : "—");
const fechaL = (f) => new Date(f).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });

// Arma el mensaje: cambia {campo} por su valor. Si falta el link de
// matrícula, esa línea no se manda; los demás campos vacíos solo se quitan.
export function mensajeBienvenida(aj, { padre, alumno, seccion }) {
  const v = { saludo: saludo(), padre: (padre || "").split(" ")[0], alumno: (alumno || "").split(" ")[0], seccion: seccion || "nuestra escuela", ...aj };
  return (aj.mensaje || AJUSTES_BASE.mensaje)
    .split("\n")
    .filter((l) => !(l.includes("{link_matricula}") && !String(aj.link_matricula || "").trim()))
    .map((l) => l.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? "").trim()).replace(/\s+$/, ""))
    .join("\n")
    .replace(/, \./, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Datos de Avisos y Bienvenida ──
export function useMarketingDatos() {
  const [d, setD] = useState({ listo: false, falta: false, bienvenidas: [], ajustes: AJUSTES_BASE, ultimaEncuesta: null });
  const cargar = useCallback(async () => {
    const [b, a, c] = await Promise.all([
      supabase.from("bienvenidas").select("*"),
      supabase.from("marketing_ajustes").select("datos").eq("id", 1).maybeSingle(),
      supabase.from("satisfaccion_campanas").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);
    setD({ listo: true, falta: !!(b.error || a.error), bienvenidas: b.data || [], ajustes: { ...AJUSTES_BASE, ...(a.data?.datos || {}) }, ultimaEncuesta: c.data?.[0]?.created_at || null });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { ...d, cargar };
}

export function nuevosSinBienvenida(data, md) {
  const desde = restarDias(Number(md.ajustes.dias_nuevo) || 15);
  const con = new Set(md.bienvenidas.map((b) => b.alumno_id));
  return data.alumnos.filter((a) => a.estado === "activo" && (a.fecha_ingreso || "") >= desde && !con.has(a.id));
}

// ── Pestaña Avisos ──
export function Avisos({ data, md, encuestas, irA }) {
  const nuevos = md.falta ? [] : nuevosSinBienvenida(data, md);
  const bajasPend = (encuestas.lista || []).filter((e) => !e.enviada_en && !e.respondida_en);
  const ult = md.ultimaEncuesta;
  const dias = ult ? Math.floor((Date.now() - new Date(ult).getTime()) / 86400000) : null;
  const tocaGeneral = dias === null || dias >= DIAS_ENCUESTA_GENERAL;
  const proxima = ult ? new Date(new Date(ult).getTime() + DIAS_ENCUESTA_GENERAL * 86400000) : null;
  const nombreSec = (id) => (data.secciones.find((s) => s.id === id)?.nombre || "").trim();
  const al = (id) => data.alumnos.find((a) => a.id === id);
  const tarjetas = [
    { id: "bienvenida", icon: UserPlus, n: nuevos.length, tit: nuevos.length ? `${nuevos.length} ${nuevos.length === 1 ? "alumno nuevo" : "alumnos nuevos"} sin bienvenida` : "Todos los alumnos nuevos tienen su bienvenida",
      txt: nuevos.length ? nuevos.slice(0, 4).map((a) => `${a.nombre} (${nombreSec(a.seccion_id) || "sin sección"})`).join(" · ") + (nuevos.length > 4 ? ` y ${nuevos.length - 4} más` : "") : `Aquí aparecen los matriculados en los últimos ${md.ajustes.dias_nuevo} días.`,
      btn: "Dar la bienvenida", alerta: nuevos.length > 0 },
    { id: "bajas", icon: UserMinus, n: bajasPend.length, tit: bajasPend.length ? `${bajasPend.length} ${bajasPend.length === 1 ? "baja" : "bajas"} sin enviar la encuesta` : "No hay encuestas de deserción pendientes",
      txt: bajasPend.length ? bajasPend.slice(0, 4).map((e) => al(e.alumno_id)?.nombre || "Alumno").join(" · ") + (bajasPend.length > 4 ? ` y ${bajasPend.length - 4} más` : "") : "Cuando administración dé de baja a un alumno, aparecerá aquí para mandarle la encuesta al padre.",
      btn: "Enviar encuestas", alerta: bajasPend.length > 0 },
    { id: "satisfaccion", icon: Smile, n: tocaGeneral ? 1 : 0, tit: tocaGeneral ? "Toca la encuesta general de satisfacción" : "Encuesta general al día",
      txt: ult ? (tocaGeneral ? `La última se creó el ${fechaL(ult)}, hace ${dias} días. Se manda cada 6 meses.` : `La última se creó el ${fechaL(ult)}. La próxima toca el ${fechaL(proxima)}.`) : "Todavía no se ha mandado ninguna. Se manda a toda la escuela cada 6 meses.",
      btn: tocaGeneral ? "Crear la encuesta" : "Ver resultados", alerta: tocaGeneral },
  ];
  return (
    <div className="mk-avisos">
      {md.falta && <div className="rm dm"><div className="rm-cuerpo"><div className="rm-frase ambar">Falta activar la bienvenida en la base de datos (archivo supabase/marketing_bienvenida.sql).</div></div></div>}
      {tarjetas.map((t) => { const I = t.icon; return (
        <div key={t.id} className={"mk-aviso" + (t.alerta ? " on" : "")}>
          <div className="mk-aviso-i"><I size={20} />{t.alerta && <span>{t.n}</span>}</div>
          <div className="mk-aviso-c"><b>{t.tit}</b><p>{t.txt}</p></div>
          <button className={"dm-btn " + (t.alerta ? "nar" : "sec")} onClick={() => irA(t.id)}>{t.btn}</button>
        </div>
      ); })}
    </div>
  );
}

// ── Pestaña Bienvenida ──
export function Bienvenida({ data, md, showToast }) {
  const [todos, setTodos] = useState(false);
  const [editar, setEditar] = useState(false);
  if (md.falta) return <div className="rm dm"><div className="rm-cuerpo"><div className="rm-frase ambar">Falta activar la bienvenida en la base de datos (archivo supabase/marketing_bienvenida.sql).</div></div></div>;
  const aj = md.ajustes;
  const desde = restarDias(Number(aj.dias_nuevo) || 15);
  const bien = (id) => md.bienvenidas.find((b) => b.alumno_id === id);
  const lista = data.alumnos
    .filter((a) => a.estado === "activo" && (todos || (a.fecha_ingreso || "") >= desde || (bien(a.id) && bien(a.id).enviada_en >= desde)))
    .sort((a, b) => (b.fecha_ingreso || "").localeCompare(a.fecha_ingreso || ""));
  const padre = (id) => data.padres.find((p) => p.id === id);
  const sec = (id) => (data.secciones.find((s) => s.id === id)?.nombre || "").trim();
  const faltanDatos = !String(aj.link_matricula || "").trim();

  const marcar = async (a, cambios = {}) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("bienvenidas").upsert({ alumno_id: a.id, enviada_en: bien(a.id)?.enviada_en || new Date().toISOString(), enviada_por: u?.user?.email || null, ...cambios });
    if (error) showToast("No se pudo guardar: " + error.message, "error"); else md.cargar();
  };

  return (
    <>
      <div className="rm dm">
        <div className="rm-cab">
          <div><div className="rm-eti">Bienvenida</div><div className="rm-tit">Alumnos nuevos</div></div>
          <div className="dm-cab-der">
            <label className="mk-check"><input type="checkbox" checked={todos} onChange={() => setTodos(!todos)} />Ver todos los activos</label>
            <button className="dm-btn sec" onClick={() => setEditar(true)}><Pencil size={14} />Editar mensaje</button>
          </div>
        </div>
        <div className="rm-cuerpo">
          {faltanDatos && <div className="rm-frase ambar" style={{ marginBottom: 14 }}><span>Falta el link de matrícula y los datos del mensaje.</span> <button className="dm-btn nar chico" onClick={() => setEditar(true)}>Completar</button></div>}
          <p className="dm-nota" style={{ marginTop: 0, marginBottom: 12 }}>{todos ? "Todos los alumnos activos." : `Matriculados desde el ${fechaC(desde)} (últimos ${aj.dias_nuevo} días).`} Toque <b>Enviar bienvenida</b> para mandar el mensaje al padre por WhatsApp.</p>
          <div className="dm-tabla-env">
            <table className="dm-tabla mk-tabla-b">
              <thead><tr><th>Alumno</th><th>Ingresó</th><th>Padre / encargado</th><th>Bienvenida</th><th>Llamada</th><th></th></tr></thead>
              <tbody>
                {lista.map((a) => { const p = padre(a.padre_id); const b = bien(a.id); const texto = mensajeBienvenida(aj, { padre: p?.nombre, alumno: a.nombre, seccion: sec(a.seccion_id) }); return (
                  <tr key={a.id}>
                    <td><b>{a.nombre}</b><div className="dm-sub">{sec(a.seccion_id) || "Sin sección"}</div></td>
                    <td>{fechaC(a.fecha_ingreso)}</td>
                    <td>{p?.nombre || "—"}{p?.telefono && <div className="dm-sub">{p.telefono}</div>}</td>
                    <td>{b ? <span className="mk-ok">Enviada {fechaC(b.enviada_en)}</span> : <span className="dm-pend">Pendiente</span>}</td>
                    <td>
                      <select value={b?.llamada || ""} disabled={!b} onChange={(e) => marcar(a, { llamada: e.target.value || null })} aria-label="Llamada" className="mk-sel-chico">
                        <option value="">—</option><option value="ofrecida">Ofrecida</option><option value="hecha">Hecha</option>
                      </select>
                    </td>
                    <td className="mk-acc">{p?.telefono
                      ? <a className={"dm-btn chico " + (b ? "sec" : "wa")} href={linkWhatsApp(p.telefono, texto)} target="_blank" rel="noreferrer" onClick={() => marcar(a)}>{b ? "Reenviar" : "Enviar bienvenida"}</a>
                      : <button className="dm-btn sec chico" onClick={async () => { try { await navigator.clipboard.writeText(texto); await marcar(a); showToast("✓ Mensaje copiado (el padre no tiene teléfono guardado)"); } catch { /* sin portapapeles */ } }}>Copiar mensaje</button>}</td>
                  </tr>
                ); })}
                {lista.length === 0 && <tr><td colSpan={6} className="dm-sub">No hay alumnos nuevos en los últimos {aj.dias_nuevo} días.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editar && <EditarMensaje md={md} showToast={showToast} onCerrar={() => setEditar(false)} ejemplo={lista[0] ? { padre: padre(lista[0].padre_id)?.nombre, alumno: lista[0].nombre, seccion: sec(lista[0].seccion_id) } : { padre: "María López", alumno: "Valeria López", seccion: "Kids A" }} />}
    </>
  );
}

function EditarMensaje({ md, showToast, onCerrar, ejemplo }) {
  const [f, setF] = useState({ ...md.ajustes });
  const [ocupado, setOcupado] = useState(false);
  const guardar = async () => {
    setOcupado(true);
    const { error } = await supabase.from("marketing_ajustes").upsert({ id: 1, datos: { ...f, dias_nuevo: Number(f.dias_nuevo) || 15 }, updated_at: new Date().toISOString() });
    setOcupado(false);
    if (error) showToast("No se pudo guardar: " + error.message, "error"); else { showToast("✓ Mensaje de bienvenida guardado"); md.cargar(); onCerrar(); }
  };
  return (
    <div className="dm-velo" onClick={onCerrar}>
      <div className="dm-ventana mk-ventana" role="dialog" aria-modal="true" aria-label="Mensaje de bienvenida" onClick={(e) => e.stopPropagation()}>
        <div className="dm-v-cab"><h3>Mensaje de bienvenida</h3><button onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        {CAMPOS.map(([k, t, ph]) => (
          <div key={k}><label className="mk-lab">{t}</label><input className="ep-input" style={{ marginTop: 0 }} value={f[k] || ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <label className="mk-lab">Contar como nuevo durante <span>(días después de matricularse)</span></label>
        <input className="ep-input" style={{ marginTop: 0, maxWidth: 120 }} type="number" min={1} max={90} value={f.dias_nuevo} onChange={(e) => setF({ ...f, dias_nuevo: e.target.value })} />
        <label className="mk-lab">Texto <span>({"{padre}"}, {"{alumno}"}, {"{seccion}"} y los datos de arriba se llenan solos)</span></label>
        <textarea className="ep-input" style={{ marginTop: 0 }} rows={9} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} />
        <button className="rm-link" style={{ marginTop: 6 }} onClick={() => setF({ ...f, mensaje: AJUSTES_BASE.mensaje })}>Volver al texto original</button>
        <label className="mk-lab">Así le llega al padre</label>
        <pre className="dm-msg">{mensajeBienvenida(f, ejemplo)}</pre>
        <div className="dm-acciones" style={{ justifyContent: "flex-end" }}>
          <button className="dm-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="dm-btn nar" disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

