// ════════════════════════════════════════════════════════════
//  INICIO → RESUMEN DEL MES (solo lectura)
//  Planilla, servicios, meta del mes, cobrado, lo que ya entró y lo que falta.
//  Las cifras salen de resumenDelMes (src/resumenMes.js), las mismas de Alertas
//  y Contabilidad.
// ════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { resumenDelMes, alertasDelSistema, MESES } from "./resumenMes";
import "./resumenMes.css";

const L = (n) => `L ${Math.round(Number(n) || 0).toLocaleString("es-HN")}`;

// c = color de la franja; vc = color de la cifra (por defecto azul de la escuela)
const K = ({ t, v, s, c, vc, dest }) => (
  <div className={"rm-k" + (dest ? " dest" : "")} style={c ? { "--rm-c": c } : undefined}>
    <div className="rm-k-t" title={t}>{t}</div>
    <div className="rm-k-v cifra" style={{ color: vc || "var(--rm-azul)" }}>{v}</div>
    {s && <div className="rm-k-s" title={typeof s === "string" ? s : undefined}>{s}</div>}
  </div>
);

export function ResumenMesInicio({ data, setPage, verAlertas }) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const [mi, setMi] = useState(hoy.getMonth());
  // Gastos fijos escritos en Alertas: se leen de la base de datos (ajustes_sistema).
  // Si la tabla aún no existe o no hay valor, queda la copia del navegador / lo último registrado.
  const [fijos, setFijos] = useState(null);
  useEffect(() => {
    let vivo = true;
    supabase.from("ajustes_sistema").select("valor").eq("clave", "gastos_fijos").maybeSingle()
      .then(({ data: fila, error }) => { if (vivo && !error && fila && Number.isFinite(Number(fila.valor))) setFijos(Number(fila.valor)); }, () => {});
    return () => { vivo = false; };
  }, []);
  const r = useMemo(() => resumenDelMes(data, anio, mi, fijos), [data, anio, mi, fijos]);
  const nAlertas = useMemo(() => (verAlertas ? alertasDelSistema(data, hoy, fijos).alertas.length : 0), [data, verAlertas, fijos]); // eslint-disable-line
  const esActual = mi === hoy.getMonth();
  const escala = Math.max(r.meta, r.cobrado, 1);
  const pct = (v) => `${Math.min(100, (v / escala) * 100)}%`;
  const cubre = r.meta > 0 ? Math.round((r.entro / r.meta) * 100) : 0;

  return (<section className="rm" aria-label="Resumen del mes">
    <div className="rm-cab">
      <div><div className="rm-eti">Resumen del mes</div><div className="rm-tit">{r.mes} {anio}</div></div>
      <select value={mi} onChange={(e) => setMi(Number(e.target.value))} aria-label="Mes">
        {MESES.slice(0, hoy.getMonth() + 1).map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
    </div>

    <div className="rm-cuerpo">
      <div className="rm-grupo">Lo que cuesta el mes</div>
      <div className="rm-fila">
        <K t="Planilla (salarios)" v={L(r.planilla.mes)} c="var(--rm-naranja)"
          s={`${r.planilla.maestros} maestros · registrado ${L(r.planilla.registrada)}`} />
        <K t="Servicios (renta, luz, internet, agua)" v={L(r.servicios.mes)} c="var(--rm-suave)"
          s={`Registrado ${L(r.servicios.registrado)}${r.otrosGastos > 0 ? ` · otros gastos ${L(r.otrosGastos)}` : ""}`} />
        <K t="Lo que debe generar la escuela" v={L(r.meta)} c="var(--rm-azul)" dest
          s="Planilla + servicios: lo mínimo para cubrirse" />
      </div>

      <div className="rm-grupo">Lo que entra</div>
      <div className="rm-fila">
        <K t="Total cobrado a padres" v={L(r.cobrado)} c="var(--rm-azul)" s={r.alumnos ? `Cobros enviados a ${r.alumnos} alumnos` : "Aún no hay cobros de este mes"} />
        <K t="Ya entró (pagado)" v={L(r.entro)} c="var(--rm-verde)" vc="var(--rm-verde)" s={r.alumnos ? `${r.alumnosPagados} de ${r.alumnos} ya pagaron` : "—"} />
        <K t="Falta por cobrar" v={L(r.falta)} c={r.falta > 0 ? "var(--rm-rojo)" : "var(--rm-verde)"} vc={r.falta > 0 ? "var(--rm-rojo)" : "var(--rm-verde)"} s={r.alumnos ? `${r.alumnos - r.alumnosPagados} alumnos pendientes` : "—"} />
      </div>

      {r.meta > 0 && <>
        <div className="rm-barra" role="img" aria-label={`Ya entró ${L(r.entro)} de una meta de ${L(r.meta)}`}>
          <div className="cob" style={{ width: pct(r.cobrado) }} />
          <div className="ent" style={{ width: pct(r.entro) }} />
          <div className="meta" style={{ left: `calc(${pct(r.meta)} - 1px)` }} title={`Meta ${L(r.meta)}`} />
        </div>
        <div className="rm-ley">
          <span><i style={{ background: "var(--rm-verde)" }} />Ya entró {L(r.entro)} ({cubre}% de la meta)</span>
          <span><i style={{ background: "var(--rm-azul)", opacity: .22 }} />Cobrado {L(r.cobrado)}</span>
          <span><i style={{ background: "var(--rm-naranja)", width: 3 }} />Meta {L(r.meta)}</span>
        </div>
      </>}

      <div className="rm-frases">
        {r.cobrado > 0 && (r.siTodosPagan >= 0
          ? <div className="rm-frase verde"><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div>Si todos pagan, después de planilla y servicios quedan <b>{L(r.siTodosPagan)}</b>.</div></div>
          : <div className="rm-frase rojo"><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div>Aunque todos paguen, lo cobrado no cubre planilla y servicios: faltan <b>{L(-r.siTodosPagan)}</b>.</div></div>)}
        {r.cobrado > 0 && (r.faltaParaMeta > 0
          ? <div className={"rm-frase " + (esActual ? "ambar" : "rojo")}><Info size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div>Con lo que ya entró faltan <b>{L(r.faltaParaMeta)}</b> para cubrir el mes{r.falta > 0 ? <>; los padres aún deben <b>{L(r.falta)}</b>.</> : "."}</div></div>
          : <div className="rm-frase verde"><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div>Lo que ya entró cubre planilla y servicios del mes.</div></div>)}
        {r.cobrado === 0 && <div className="rm-frase"><Info size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div>Todavía no hay cobros de mensualidad de {r.mes}. La escuela necesita generar <b>{L(r.meta)}</b> este mes.</div></div>}
      </div>

      <div className="rm-pie">
        <span>Planilla = salario de cada maestro en Maestros. Servicios = {r.servicios.manual ? "los gastos fijos escritos en Alertas" : "la última renta, luz, internet y agua registradas"}. Cobrado y pagado como en Contabilidad.</span>
        {verAlertas && <button type="button" className="rm-link" onClick={() => setPage("alertas")}>Ver alertas{nAlertas > 0 && <span className="n">{nAlertas}</span>}</button>}
      </div>
    </div>
  </section>);
}
