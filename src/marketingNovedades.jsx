// ════════════════════════════════════════════════════════════
// MARKETING RELACIONAL → NOVEDADES (solo administración)
//
// Para que administración vea el trabajo de Marketing (Nayeli) sin entrar a
// cada pestaña:
//  - Pendientes: alumnos nuevos sin bienvenida, bajas sin encuesta enviada,
//    familias sin la encuesta de satisfacción y la encuesta general de cada
//    6 meses. Pasan a "atrasado" cuando llevan más de DIAS_ATRASO días.
//  - Lo que se hizo: bienvenidas, encuestas enviadas y respuestas recibidas,
//    de la más reciente a la más vieja.
// Además, AvisoNovedadesInicio pone un aviso corto en Inicio.
// Solo lee tablas que ya existen; no cambia nada en la base de datos.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { AJUSTES_BASE, DIAS_ENCUESTA_GENERAL } from "./marketingAvisos";
import { UserPlus, UserMinus, Smile, Send, CheckCircle2, Megaphone, PhoneCall, Heart } from "lucide-react";

export const DIAS_ATRASO = 2; // días para que un pendiente cuente como atrasado
const DIA = 86400000;
const ms = (f) => (f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).getTime() : 0);
const diasDesde = (f) => Math.floor((Date.now() - ms(f)) / DIA);
const fechaC = (f) => new Date(ms(f)).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
const cuando = (f) => {
  const d = diasDesde(f);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return fechaC(f);
};

// ── Datos ──
export function useNovedades(data) {
  const [d, setD] = useState(null); // null = cargando, false = falta activar en la BD
  const cargar = useCallback(async () => {
    const [b, a, e, c, r, p] = await Promise.all([
      supabase.from("bienvenidas").select("*"),
      supabase.from("marketing_ajustes").select("datos").eq("id", 1).maybeSingle(),
      supabase.from("encuestas_desercion").select("id,alumno_id,seccion_id,fecha_baja,enviada_en,respondida_en,motivo,created_at"),
      supabase.from("satisfaccion_campanas").select("id,nombre,cerrada,created_at").order("created_at", { ascending: false }),
      supabase.from("satisfaccion_respuestas").select("id,campana_id,padre_id,alumnos,enviada_en,respondida_en,created_at"),
      supabase.from("perfiles").select("maestro_id,rol").eq("rol", "marketing"),
    ]);
    if (b.error || e.error || c.error || r.error) { setD(false); return; }
    setD({ bienvenidas: b.data || [], ajustes: { ...AJUSTES_BASE, ...(a.data?.datos || {}) }, bajas: e.data || [], campanas: c.data || [], respuestas: r.data || [], marketing: p.data || [] });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const calc = useMemo(() => {
    if (!d) return null;
    const al = Object.fromEntries(data.alumnos.map((x) => [x.id, x]));
    const pad = Object.fromEntries((data.padres || []).map((x) => [x.id, x]));
    const sec = (id) => (data.secciones.find((s) => s.id === id)?.nombre || "").trim();
    const quien = (() => {
      const m = d.marketing.map((x) => (data.maestros || []).find((mm) => mm.id === x.maestro_id)?.nombre).filter(Boolean);
      return m.length === 1 ? m[0].split(" ")[0] : "Marketing";
    })();

    // Pendientes
    const desde = d.ajustes.desde || AJUSTES_BASE.desde;
    const conBien = new Set(d.bienvenidas.map((x) => x.alumno_id));
    const nuevos = data.alumnos.filter((a) => a.estado === "activo" && (a.fecha_ingreso || "") >= desde && !conBien.has(a.id))
      .map((a) => ({ id: a.id, nombre: a.nombre, extra: sec(a.seccion_id), desde: a.fecha_ingreso, dias: diasDesde(a.fecha_ingreso) }));
    const bajas = d.bajas.filter((x) => !x.enviada_en && !x.respondida_en)
      .map((x) => { const f = x.fecha_baja || x.created_at; return { id: x.id, nombre: al[x.alumno_id]?.nombre || "Alumno", extra: sec(x.seccion_id), desde: f, dias: diasDesde(f) }; });
    const activa = d.campanas.find((x) => !x.cerrada);
    const sinEnviar = activa ? d.respuestas.filter((x) => x.campana_id === activa.id && !x.enviada_en && !x.respondida_en) : [];
    const diasActiva = activa ? diasDesde(activa.created_at) : 0;
    const ult = d.campanas[0]?.created_at || null;
    const diasGeneral = ult ? diasDesde(ult) : null;
    const tocaGeneral = diasGeneral === null || diasGeneral >= DIAS_ENCUESTA_GENERAL;
    const atr = (l) => l.filter((x) => x.dias > DIAS_ATRASO);
    const pendientes = [
      { id: "bienvenida", icon: UserPlus, tit: "Bienvenidas", lista: nuevos, atrasados: atr(nuevos).length,
        vacio: "Todos los alumnos nuevos ya tienen su bienvenida.", que: (n) => `${n} ${n === 1 ? "alumno nuevo" : "alumnos nuevos"} sin bienvenida` },
      { id: "bajas", icon: UserMinus, tit: "Encuestas de salida", lista: bajas, atrasados: atr(bajas).length,
        vacio: "Todas las bajas ya tienen su encuesta enviada.", que: (n) => `${n} ${n === 1 ? "baja" : "bajas"} sin enviar la encuesta` },
      { id: "satisfaccion", icon: Smile, tit: "Encuesta de satisfacción", lista: sinEnviar.map((x) => ({ id: x.id, nombre: pad[x.padre_id]?.nombre || "Familia", extra: x.alumnos || "", desde: activa.created_at, dias: diasActiva })),
        atrasados: diasActiva > 7 ? sinEnviar.length : 0, sinCreada: !activa,
        vacio: activa ? `Ya se mandó a todas las familias de «${activa.nombre}».` : "No hay una encuesta abierta ahora.", que: (n) => `${n} ${n === 1 ? "familia" : "familias"} sin recibir la encuesta` },
      { id: "general", icon: Megaphone, tit: "Encuesta general (cada 6 meses)", lista: [], atrasados: tocaGeneral && diasGeneral !== null ? 1 : 0, toca: tocaGeneral,
        vacio: ult ? `Al día. La última se creó el ${fechaC(ult)} y la próxima toca el ${fechaC(ms(ult) + DIAS_ENCUESTA_GENERAL * DIA)}.` : "",
        que: () => (ult ? `Toca la encuesta general: la última fue hace ${diasGeneral} días` : "Todavía no se ha creado la primera encuesta general") },
    ];

    // Lo que se hizo (de lo más reciente a lo más viejo)
    const hechos = [];
    d.bienvenidas.forEach((x) => {
      const a = al[x.alumno_id];
      hechos.push({ f: x.enviada_en, tipo: "bienvenida", icon: UserPlus, txt: <>Mandó la bienvenida a la familia de <b>{a?.nombre || "un alumno"}</b>{a ? ` (${sec(a.seccion_id) || "sin sección"})` : ""}</> });
      if (x.llamada === "hecha") hechos.push({ f: x.enviada_en, tipo: "bienvenida", icon: PhoneCall, txt: <>Hizo la llamada de matrícula con la familia de <b>{a?.nombre || "un alumno"}</b></>, sinHora: true });
    });
    d.bajas.forEach((x) => {
      const n = al[x.alumno_id]?.nombre || "un alumno";
      if (x.enviada_en) hechos.push({ f: x.enviada_en, tipo: "bajas", icon: Send, txt: <>Envió la encuesta de salida al padre de <b>{n}</b></> });
      if (x.respondida_en) hechos.push({ f: x.respondida_en, tipo: "respuesta", icon: CheckCircle2, txt: <>El padre de <b>{n}</b> respondió la encuesta de salida{x.motivo ? <>: «{x.motivo}»</> : ""}</> });
    });
    d.campanas.forEach((x) => hechos.push({ f: x.created_at, tipo: "satisfaccion", icon: Megaphone, txt: <>Creó la encuesta de satisfacción <b>{x.nombre}</b></> }));
    d.respuestas.forEach((x) => {
      const n = pad[x.padre_id]?.nombre || "una familia";
      if (x.enviada_en) hechos.push({ f: x.enviada_en, tipo: "satisfaccion", icon: Send, txt: <>Envió la encuesta de satisfacción a <b>{n}</b>{x.alumnos ? ` (${x.alumnos})` : ""}</> });
      if (x.respondida_en) hechos.push({ f: x.respondida_en, tipo: "respuesta", icon: Heart, txt: <><b>{n}</b> respondió la encuesta de satisfacción</> });
    });
    hechos.sort((a, b) => ms(b.f) - ms(a.f));

    const semana = hechos.filter((h) => diasDesde(h.f) < 7);
    const resumen = {
      bienvenidas: semana.filter((h) => h.tipo === "bienvenida" && !h.sinHora).length,
      enviadas: semana.filter((h) => (h.tipo === "bajas" || h.tipo === "satisfaccion") && h.icon === Send).length,
      respuestas: semana.filter((h) => h.tipo === "respuesta").length,
      pendientes: nuevos.length + bajas.length + sinEnviar.length + (tocaGeneral ? 1 : 0),
      atrasados: pendientes.reduce((s, p) => s + p.atrasados, 0),
    };
    const ultimoHecho = hechos.find((h) => h.tipo !== "respuesta") || null;
    return { quien, pendientes, hechos, resumen, ultimoHecho };
  }, [d, data]);

  return { listo: d !== null, falta: d === false, calc, cargar };
}

// ── Pestaña Novedades (dentro de Marketing relacional, solo administración) ──
export function Novedades({ data, nov: novExt }) {
  const propio = useNovedades(data);
  const nov = novExt || propio;
  const [rango, setRango] = useState(7);
  const [tipo, setTipo] = useState("todo");
  if (!nov.listo) return <div className="mk-nov-vacio">Cargando novedades…</div>;
  if (nov.falta) return <div className="rm dm"><div className="rm-cuerpo"><div className="rm-frase ambar">Falta activar Marketing relacional en la base de datos.</div></div></div>;
  const { quien, pendientes, hechos, resumen, ultimoHecho } = nov.calc;
  const visibles = hechos.filter((h) => diasDesde(h.f) < rango && (tipo === "todo" || h.tipo === tipo));
  const kpis = [
    { l: "Atrasados", v: resumen.atrasados, c: resumen.atrasados ? "rojo" : "verde", s: `más de ${DIAS_ATRASO} días sin hacer` },
    { l: "Pendientes", v: resumen.pendientes, c: resumen.pendientes ? "ambar" : "verde", s: "por hacer" },
    { l: "Enviadas esta semana", v: resumen.bienvenidas + resumen.enviadas, c: "azul", s: `${resumen.bienvenidas} ${resumen.bienvenidas === 1 ? "bienvenida" : "bienvenidas"} · ${resumen.enviadas} ${resumen.enviadas === 1 ? "encuesta" : "encuestas"}` },
    { l: "Respuestas esta semana", v: resumen.respuestas, c: "verde", s: "de padres y familias" },
  ];
  return (
    <div className="mk-nov">
      <div className="mk-nov-intro">
        <b>Trabajo de {quien}</b>
        <span>{ultimoHecho ? <>Último movimiento: {cuando(ultimoHecho.f)}.</> : "Todavía no hay movimientos."} Se cuenta como atrasado lo que lleva más de {DIAS_ATRASO} días sin hacerse.</span>
      </div>
      <div className="mk-nov-kpis">
        {kpis.map((k) => <div key={k.l} className={"mk-nov-kpi " + k.c}><span>{k.l}</span><b>{k.v}</b><small>{k.s}</small></div>)}
      </div>

      <h3 className="mk-nov-h">Pendientes de {quien}</h3>
      <div className="mk-nov-pend">
        {pendientes.map((p) => {
          const I = p.icon;
          const n = p.id === "general" ? (p.toca ? 1 : 0) : p.lista.length;
          const est = p.atrasados ? "atrasado" : n ? "pendiente" : "ok";
          return (
            <div key={p.id} className={"mk-nov-p " + est}>
              <div className="mk-nov-p-cab">
                <I size={18} />
                <b>{p.tit}</b>
                <span className={"mk-nov-est " + est}>{est === "atrasado" ? (p.atrasados > 1 ? `${p.atrasados} atrasados` : "Atrasado") : est === "pendiente" ? "Pendiente" : "Al día"}</span>
              </div>
              <p>{n ? p.que(n) : p.vacio}</p>
              {p.lista.length > 0 && (
                <ul>
                  {[...p.lista].sort((a, b) => b.dias - a.dias).slice(0, 5).map((x) => (
                    <li key={x.id}><span>{x.nombre}{x.extra ? <em> · {x.extra}</em> : null}</span><i className={x.dias > (p.id === "satisfaccion" ? 7 : DIAS_ATRASO) ? "tarde" : ""}>{x.dias <= 0 ? "hoy" : `${x.dias} ${x.dias === 1 ? "día" : "días"}`}</i></li>
                  ))}
                  {p.lista.length > 5 && <li className="mas">y {p.lista.length - 5} más</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mk-nov-h-fila">
        <h3 className="mk-nov-h">Lo que hizo {quien}</h3>
        <div className="mk-filtros">
          {[["todo", "Todo"], ["bienvenida", "Bienvenidas"], ["bajas", "Salida"], ["satisfaccion", "Satisfacción"], ["respuesta", "Respuestas"]].map(([k, t]) => (
            <button key={k} className={tipo === k ? "on" : ""} onClick={() => setTipo(k)}>{t}</button>
          ))}
          <select value={rango} onChange={(e) => setRango(Number(e.target.value))}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={3650}>Todo</option>
          </select>
        </div>
      </div>
      <div className="mk-nov-lista">
        {visibles.length === 0 && <div className="mk-nov-vacio">No hay movimientos en este periodo.</div>}
        {visibles.slice(0, 80).map((h, i) => {
          const I = h.icon;
          return (
            <div key={i} className={"mk-nov-h-i " + h.tipo}>
              <div className="mk-nov-ico"><I size={16} /></div>
              <div className="mk-nov-txt">{h.txt}</div>
              <time>{cuando(h.f)}</time>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Aviso corto en Inicio (administración) ──
export function AvisoNovedadesInicio({ data, setPage }) {
  const nov = useNovedades(data);
  if (!nov.listo || nov.falta) return null;
  const { quien, resumen, ultimoHecho } = nov.calc;
  const hayAlgo = resumen.atrasados || resumen.pendientes || resumen.respuestas || resumen.bienvenidas || resumen.enviadas;
  if (!hayAlgo) return null;
  const partes = [];
  if (resumen.atrasados) partes.push(`${resumen.atrasados} ${resumen.atrasados === 1 ? "atrasado" : "atrasados"}`);
  if (resumen.pendientes) partes.push(`${resumen.pendientes} ${resumen.pendientes === 1 ? "pendiente" : "pendientes"}`);
  const hechos = resumen.bienvenidas + resumen.enviadas;
  if (hechos) partes.push(`${hechos} ${hechos === 1 ? "envío" : "envíos"} esta semana`);
  if (resumen.respuestas) partes.push(`${resumen.respuestas} ${resumen.respuestas === 1 ? "respuesta nueva" : "respuestas nuevas"}`);
  return (
    <div className={"mk-nov-inicio" + (resumen.atrasados ? " atrasado" : "")}>
      <div className="mk-aviso-i"><Heart size={20} /></div>
      <div className="mk-aviso-c">
        <b>Novedades de Marketing · {quien}</b>
        <p>{partes.join(" · ")}{ultimoHecho ? `. Último movimiento ${cuando(ultimoHecho.f)}.` : "."}</p>
      </div>
      <button className={"dm-btn " + (resumen.atrasados ? "nar" : "sec")} onClick={() => setPage("marketing")}>Ver novedades</button>
    </div>
  );
}
