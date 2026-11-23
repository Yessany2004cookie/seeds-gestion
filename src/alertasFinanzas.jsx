// ════════════════════════════════════════════════════════════
//  FINANZAS → ALERTAS
//  Pantalla de solo lectura: no escribe nada en la base de datos.
//  1) Quién debe (por alumno, con meses vencidos y antigüedad)
//  2) Sostenibilidad de cada grupo (lo que cobra vs. lo que cuesta)
//  3) Otras alertas: cuentas por pagar atrasadas y registros repetidos
// ════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { card, input, label, badge, btnO } from "./estilo";
import { AlertTriangle, Users, Phone, TrendingDown, CheckCircle, Info } from "lucide-react";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ROJO = "#DC2626", AMARILLO = "#D97706", VERDE = "#059669", GRIS = "#64748B";
const L = (n) => `L ${Math.round(Number(n) || 0).toLocaleString("es-HN")}`;
const DIA = 1000 * 60 * 60 * 24;

// Teléfono a formato WhatsApp de Honduras (igual que en Recordatorios)
const telWA = (tel) => {
  let d = String(tel || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "504" + d;
  return d;
};
const leerNum = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : Number(v); } catch (e) { return def; } };
const guardarNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };

// Año de un cobro: el guardado o el de su fecha de emisión
const anioDe = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4)) || new Date().getFullYear();
// Fecha límite de pago de un cobro (día de vencimiento de su sección, por defecto 28)
const limiteDe = (f, sec) => {
  const mi = MESES.indexOf(f.mes_correspondiente);
  if (mi < 0) return null;
  const dia = Math.min(Math.max(Number(sec?.dia_vencimiento) || 28, 1), 31);
  return new Date(anioDe(f), mi, dia, 23, 59, 59);
};
// Mensualidad de un alumno: 0 si es becado, el monto personalizado si tiene, si no la de la sección
const cuotaDe = (al, sec) => (al.beca === true ? 0 : (Number(al.monto_personalizado) > 0 ? Number(al.monto_personalizado) : Number(sec?.mensualidad) || 0));
const esActivo = (al) => (al.estado || "activo") === "activo";

// Gastos fijos del mes: la última renta + la última luz + el último internet/agua registrados
function gastosFijosSugeridos(data) {
  const regs = [
    ...(data.gastos || []).map((g) => ({ t: g.tipo, d: g.descripcion, m: Number(g.monto) || 0, f: g.fecha || g.created_at || "" })),
    ...(data.cuentas_por_pagar || []).map((c) => ({ t: c.tipo, d: c.descripcion, m: Number(c.monto) || 0, f: c.created_at || "" })),
  ].sort((a, b) => String(b.f).localeCompare(String(a.f)));
  const ultimo = (fn) => regs.find(fn)?.m || 0;
  return ultimo((r) => r.t === "renta")
    + ultimo((r) => /luz|energ/i.test(r.d || ""))
    + ultimo((r) => /internet/i.test(r.d || ""))
    + ultimo((r) => /agua/i.test(r.d || ""));
}

const Tarjeta = ({ color, titulo, valor, sub }) => (
  <div style={{ ...card, marginBottom: 0, padding: 16, borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: 11, color: GRIS, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{titulo}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
    {sub && <div style={{ fontSize: 11, color: GRIS, marginTop: 2 }}>{sub}</div>}
  </div>
);

const th = { textAlign: "left", padding: "8px", fontSize: 11, color: GRIS, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", borderBottom: "1px solid #F1F5F9", verticalAlign: "top" };

export function AlertasFinanzasPage({ data }) {
  const hoy = new Date();
  const [tab, setTab] = useState("deudores");
  const [filtro, setFiltro] = useState("todos"); // todos | rojo | retirados
  const sugeridoFijos = useMemo(() => gastosFijosSugeridos(data), [data]);
  const [fijos, setFijosRaw] = useState(() => leerNum("seeds_gastos_fijos", 0));
  const fijosMes = fijos > 0 ? fijos : sugeridoFijos;
  const setFijos = (v) => { const n = Math.max(0, Number(v) || 0); setFijosRaw(n); guardarNum("seeds_gastos_fijos", n); };
  const [margenMin, setMargenRaw] = useState(() => leerNum("seeds_margen_min", 15));
  const setMargen = (v) => { const n = Math.min(90, Math.max(0, Number(v) || 0)); setMargenRaw(n); guardarNum("seeds_margen_min", n); };
  // Mes para medir la cobranza: el mes anterior (ya vencido)
  const mesPrevIdx = (hoy.getMonth() + 11) % 12;
  const [mesCob, setMesCob] = useState(MESES[mesPrevIdx]);
  // Un mes "después" del actual es del año pasado (ej. en enero, Diciembre = año anterior)
  const anioCob = MESES.indexOf(mesCob) > hoy.getMonth() ? hoy.getFullYear() - 1 : hoy.getFullYear();

  const secPorId = useMemo(() => Object.fromEntries((data.secciones || []).map((s) => [s.id, s])), [data.secciones]);
  const alPorId = useMemo(() => Object.fromEntries((data.alumnos || []).map((a) => [a.id, a])), [data.alumnos]);
  const padrePorId = useMemo(() => Object.fromEntries((data.padres || []).map((p) => [p.id, p])), [data.padres]);

  // ── Cobros de mensualidad activos, sin repetidos (mismo alumno, mes y año cuentan una vez) ──
  const { cobrosUnicos, repetidos } = useMemo(() => {
    const vistos = new Map(); const rep = [];
    (data.facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada").forEach((f) => {
      const k = `${f.alumno_id}|${f.mes_correspondiente}|${anioDe(f)}`;
      if (vistos.has(k)) rep.push({ f, primero: vistos.get(k) }); else vistos.set(k, f);
    });
    return { cobrosUnicos: [...vistos.values()], repetidos: rep };
  }, [data.facturas]);

  // ── 1) Deudores: cobros pendientes que ya pasaron su fecha límite ──
  const deudores = useMemo(() => {
    const porAlumno = new Map();
    cobrosUnicos.filter((f) => f.estado === "pendiente").forEach((f) => {
      const al = alPorId[f.alumno_id]; if (!al) return;
      const sec = secPorId[al.seccion_id];
      const lim = limiteDe(f, sec); if (!lim || lim > hoy) return; // aún no vence
      const saldo = Number(f.saldo) > 0 ? Number(f.saldo) : Number(f.monto_total) || 0;
      const r = porAlumno.get(al.id) || { al, sec, meses: [], monto: 0, masViejo: lim };
      r.meses.push(`${f.mes_correspondiente.slice(0, 3)} ${String(anioDe(f)).slice(2)}`);
      r.monto += saldo; if (lim < r.masViejo) r.masViejo = lim;
      porAlumno.set(al.id, r);
    });
    return [...porAlumno.values()].map((r) => {
      const dias = Math.floor((hoy - r.masViejo) / DIA);
      const retirado = !esActivo(r.al);
      const nivel = retirado || r.meses.length >= 2 ? "rojo" : "amarillo";
      const padre = padrePorId[r.al.padre_id];
      return { ...r, dias, retirado, nivel, padre, revisar: r.meses.length >= 6 };
    }).sort((a, b) => b.monto - a.monto);
  }, [cobrosUnicos, alPorId, secPorId, padrePorId]);

  // ── 2) Sostenibilidad por grupo ──
  const grupos = useMemo(() => {
    const secs = (data.secciones || []).filter((s) => s.activa !== false);
    const activosDe = (sid) => (data.alumnos || []).filter((a) => a.seccion_id === sid && esActivo(a));
    const totalAlumnos = secs.reduce((s, x) => s + activosDe(x.id).length, 0);
    const fijoPorAlumno = totalAlumnos > 0 ? fijosMes / totalAlumnos : 0;
    return secs.map((s) => {
      const als = activosDe(s.id);
      const becas = als.filter((a) => a.beca === true).length;
      const esperado = als.reduce((t, a) => t + cuotaDe(a, s), 0);
      const maestros = (data.maestros || []).filter((m) => Array.isArray(m.secciones_ids) && m.secciones_ids.includes(s.id));
      const costoMaestro = maestros.reduce((t, m) => t + (Number(m.salario) || 0) / Math.max(1, m.secciones_ids.length), 0);
      const fijo = fijoPorAlumno * als.length;
      const resultado = esperado - costoMaestro - fijo;
      const margen = esperado > 0 ? (resultado / esperado) * 100 : -100;
      // Cobranza real del mes elegido (cobros de alumnos de este grupo)
      const delMes = cobrosUnicos.filter((f) => f.mes_correspondiente === mesCob && anioDe(f) === anioCob && alPorId[f.alumno_id]?.seccion_id === s.id);
      const cobrado = delMes.filter((f) => f.estado === "pagada").reduce((t, f) => t + (Number(f.monto_total) || 0), 0);
      const facturado = delMes.reduce((t, f) => t + (Number(f.monto_total) || 0), 0);
      const pctCob = facturado > 0 ? (cobrado / facturado) * 100 : null;
      const cuotaProm = Number(s.mensualidad) || (als.length ? esperado / Math.max(1, als.length - becas) : 0);
      const equilibrio = cuotaProm > 0 ? Math.ceil((costoMaestro + fijo) / cuotaProm) : null;
      const motivos = [];
      if (resultado < 0) motivos.push(`Pierde ${L(-resultado)} al mes`);
      else if (margen < margenMin) motivos.push(`Deja solo ${margen.toFixed(0)}% de lo que cobra`);
      if (als.length > 0 && becas / als.length >= 0.5) motivos.push(`${becas} de ${als.length} alumnos becados`);
      if (pctCob !== null && pctCob < 70) motivos.push(`Cobró ${pctCob.toFixed(0)}% de ${mesCob}`);
      if (maestros.length === 0) motivos.push("Sin maestro asignado en la app (costo incompleto)");
      const nivel = resultado < 0 ? "rojo" : motivos.length ? "amarillo" : "verde";
      return { s, n: als.length, becas, esperado, maestros, costoMaestro, fijo, resultado, margen, cobrado, facturado, pctCob, equilibrio, motivos, nivel };
    }).sort((a, b) => a.resultado - b.resultado);
  }, [data.secciones, data.alumnos, data.maestros, fijosMes, cobrosUnicos, alPorId, mesCob, anioCob, margenMin]);

  // ── 3) Otras alertas ──
  const cxpAtrasadas = (data.cuentas_por_pagar || []).filter((c) => !c.pagada).filter((c) => {
    const mi = MESES.indexOf(c.mes_correspondiente); const an = Number(c.anio_correspondiente) || hoy.getFullYear();
    return an < hoy.getFullYear() || (an === hoy.getFullYear() && mi < hoy.getMonth());
  });
  const compRepetidos = useMemo(() => {
    const m = new Map();
    (data.facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.cobro_id && f.estado !== "anulada").forEach((f) => m.set(f.cobro_id, [...(m.get(f.cobro_id) || []), f]));
    return [...m.values()].filter((v) => v.length > 1);
  }, [data.facturas]);
  const nOtras = cxpAtrasadas.length + repetidos.length + compRepetidos.length;

  const totDeuda = deudores.reduce((s, d) => s + d.monto, 0);
  const rojosDeu = deudores.filter((d) => d.nivel === "rojo").length;
  const gruposRojo = grupos.filter((g) => g.nivel === "rojo").length;
  const gruposAmarillo = grupos.filter((g) => g.nivel === "amarillo").length;
  const ancho = typeof window !== "undefined" ? window.innerWidth : 1200;

  const verDeudores = deudores.filter((d) => filtro === "todos" || (filtro === "rojo" ? d.nivel === "rojo" : d.retirado));
  const msgWA = (d) => `Estimado padre de familia, le recordamos que ${d.al.nombre} tiene pendiente${d.meses.length > 1 ? "s" : ""} ${d.meses.length} mensualidad${d.meses.length > 1 ? "es" : ""} (${d.meses.join(", ")}), por un total de ${L(d.monto)}. Favor ponerse al día o comunicarse con administración. Seeds English School`;

  const Pestaña = ({ id, txt, n, c }) => (
    <button onClick={() => setTab(id)} style={{ ...btnO, background: tab === id ? "#1E293B" : btnO.background, color: tab === id ? "#fff" : btnO.color, fontWeight: 700 }}>
      {txt}{n > 0 && <span style={{ ...badge(c), background: tab === id ? "#fff" : badge(c).background }}>{n}</span>}
    </button>
  );

  return (<div>
    <div style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(239,246,255,.75)" }}>
      <Info size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: "#1E3A8A", lineHeight: 1.5 }}>
        <b>Finanzas</b> sirve para decidir y actuar: quién debe, qué grupo no se sostiene y qué hay que pagar. Esta pantalla solo lee datos; no cambia nada.
        Las cifras contables oficiales (ganancia, balance) saldrán del módulo de <b>Contabilidad</b>.
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: ancho > 900 ? "repeat(4,1fr)" : ancho > 520 ? "repeat(2,1fr)" : "1fr", gap: 12, marginBottom: 16 }}>
      <Tarjeta color={ROJO} titulo="Padres con deuda vencida" valor={deudores.length} sub={`${rojosDeu} con 2+ meses o retirados`} />
      <Tarjeta color={AMARILLO} titulo="Total vencido por cobrar" valor={L(totDeuda)} sub="Sin contar cobros repetidos" />
      <Tarjeta color={gruposRojo ? ROJO : VERDE} titulo="Grupos que pierden dinero" valor={gruposRojo} sub={`${gruposAmarillo} en riesgo`} />
      <Tarjeta color={nOtras ? AMARILLO : VERDE} titulo="Otras alertas" valor={nOtras} sub="Pagos atrasados y repetidos" />
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <Pestaña id="deudores" txt="Quién debe" n={deudores.length} c={ROJO} />
      <Pestaña id="grupos" txt="Sostenibilidad por grupo" n={gruposRojo + gruposAmarillo} c={gruposRojo ? ROJO : AMARILLO} />
      <Pestaña id="otras" txt="Otras alertas" n={nOtras} c={AMARILLO} />
    </div>

    {tab === "deudores" && <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Users size={16} color={ROJO} />Padres con mensualidades vencidas</h3>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>
          <option value="todos">Todos ({deudores.length})</option>
          <option value="rojo">Urgentes: 2+ meses o retirados ({rojosDeu})</option>
          <option value="retirados">Alumnos retirados con deuda ({deudores.filter((d) => d.retirado).length})</option>
        </select>
      </div>
      {verDeudores.length === 0 ? <p style={{ fontSize: 13, color: VERDE, textAlign: "center", padding: 20 }}>✓ Nadie en esta lista</p> :
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}>{["", "Alumno", "Grupo", "Meses vencidos", "Atraso", "Debe", "Padre", ""].map((h, i) => <th key={i} style={{ ...th, textAlign: h === "Debe" ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>{verDeudores.map((d) => {
            const tel = telWA(d.padre?.telefono || d.al.telefono);
            return (<tr key={d.al.id}>
              <td style={td}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: d.nivel === "rojo" ? ROJO : AMARILLO }} /></td>
              <td style={{ ...td, fontWeight: 600 }}>{d.al.nombre}{d.retirado && <div><span style={badge(ROJO)}>Retirado</span></div>}{d.revisar && <div><span style={badge(GRIS)}>Revisar: {d.meses.length} meses</span></div>}</td>
              <td style={td}>{d.sec?.nombre || "—"}</td>
              <td style={td}><b>{d.meses.length}</b> <span style={{ color: GRIS, fontSize: 11 }}>{d.meses.length <= 4 ? d.meses.join(", ") : `${d.meses.slice(0, 2).join(", ")} … ${d.meses[d.meses.length - 1]}`}</span></td>
              <td style={{ ...td, whiteSpace: "nowrap", color: d.dias > 60 ? ROJO : d.dias > 30 ? AMARILLO : "#334155" }}>{d.dias} días</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{L(d.monto)}</td>
              <td style={td}>{d.padre?.nombre || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{tel ? <a href={`https://wa.me/${tel}?text=${encodeURIComponent(msgWA(d))}`} target="_blank" rel="noreferrer" title="Enviar recordatorio por WhatsApp" style={{ background: "#25D366", padding: "5px 8px", borderRadius: 6, display: "inline-flex" }}><Phone size={13} color="#fff" /></a> : <span style={{ fontSize: 11, color: ROJO }}>Sin tel.</span>}</td>
            </tr>);
          })}</tbody>
        </table></div>}
      <p style={{ fontSize: 11, color: GRIS, margin: "10px 0 0" }}>Solo cuenta mensualidades que ya pasaron su fecha límite. Rojo: 2 o más meses, o alumno retirado. Amarillo: 1 mes. "Revisar" marca 6 meses o más, que puede ser un cobro cargado por error.</p>
    </div>}

    {tab === "grupos" && <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><TrendingDown size={16} color={ROJO} />¿Cada grupo se paga solo?</h3>
      <div style={{ display: "grid", gridTemplateColumns: ancho > 700 ? "1fr 1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
        <div><label style={label}>Gastos fijos al mes (renta, luz, internet)</label>
          <input type="number" value={fijos > 0 ? fijos : ""} placeholder={`Sugerido: ${Math.round(sugeridoFijos)}`} onChange={(e) => setFijos(e.target.value)} style={input} />
          <div style={{ fontSize: 10.5, color: GRIS, marginTop: 3 }}>Se reparten por alumno entre todos los grupos. Vacío = usa lo último registrado ({L(sugeridoFijos)}).</div></div>
        <div><label style={label}>Ganancia mínima sana por grupo (%)</label>
          <input type="number" value={margenMin} onChange={(e) => setMargen(e.target.value)} style={input} /></div>
        <div><label style={label}>Mes para medir la cobranza</label>
          <select value={mesCob} onChange={(e) => setMesCob(e.target.value)} style={{ ...input, cursor: "pointer" }}>{MESES.map((m) => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr style={{ borderBottom: "2px solid #E2E8F0" }}>{["", "Grupo", "Alumnos", "Cobra al mes", "Maestro", "Gastos fijos", "Resultado", `Cobrado ${mesCob.slice(0, 3)}`, "Equilibrio", "Por qué"].map((h, i) => <th key={i} style={{ ...th, textAlign: ["Cobra al mes", "Maestro", "Gastos fijos", "Resultado"].includes(h) ? "right" : "left" }}>{h}</th>)}</tr></thead>
        <tbody>{grupos.map((g) => (<tr key={g.s.id}>
          <td style={td}>{g.nivel === "verde" ? <CheckCircle size={14} color={VERDE} /> : <AlertTriangle size={14} color={g.nivel === "rojo" ? ROJO : AMARILLO} />}</td>
          <td style={{ ...td, fontWeight: 600 }}>{g.s.nombre}</td>
          <td style={td}>{g.n}{g.becas > 0 && <span style={{ color: GRIS, fontSize: 11 }}> ({g.becas} beca{g.becas > 1 ? "s" : ""})</span>}</td>
          <td style={{ ...td, textAlign: "right" }}>{L(g.esperado)}</td>
          <td style={{ ...td, textAlign: "right" }} title={g.maestros.map((m) => `${m.nombre}: ${L(m.salario)} entre ${m.secciones_ids.length} grupo(s)`).join("\n")}>{L(g.costoMaestro)}{g.maestros.length > 1 && <div style={{ fontSize: 10.5, color: GRIS }}>{g.maestros.length} maestros</div>}</td>
          <td style={{ ...td, textAlign: "right" }}>{L(g.fijo)}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 800, color: g.resultado < 0 ? ROJO : VERDE }}>{g.resultado < 0 ? "−" : ""}{L(Math.abs(g.resultado))}<div style={{ fontSize: 10.5, fontWeight: 600, color: GRIS }}>{g.esperado > 0 ? `${g.margen.toFixed(0)}%` : ""}</div></td>
          <td style={{ ...td, color: g.pctCob !== null && g.pctCob < 70 ? ROJO : "#334155" }}>{g.pctCob === null ? "—" : `${L(g.cobrado)} (${g.pctCob.toFixed(0)}%)`}</td>
          <td style={td}>{g.equilibrio === null ? "—" : <span title="Alumnos pagando que necesita para no perder">{g.equilibrio} pagando</span>}</td>
          <td style={{ ...td, fontSize: 11.5, color: g.nivel === "rojo" ? ROJO : g.nivel === "amarillo" ? AMARILLO : VERDE }}>{g.motivos.length ? g.motivos.join(" · ") : "Sostenible"}</td>
        </tr>))}</tbody>
      </table></div>
      <p style={{ fontSize: 11, color: GRIS, margin: "10px 0 0", lineHeight: 1.5 }}>
        <b>Resultado</b> = lo que cobra al mes (sin becados) − salario del maestro repartido entre sus grupos − su parte de gastos fijos.
        <b> Equilibrio</b> = cuántos alumnos pagando necesita para no perder. El costo del maestro depende de que cada maestro tenga bien marcados sus grupos en Maestros.
      </p>
    </div>}

    {tab === "otras" && <div style={card}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={16} color={AMARILLO} />Otras alertas</h3>
      {nOtras === 0 && <p style={{ fontSize: 13, color: VERDE, textAlign: "center", padding: 20 }}>✓ Sin alertas</p>}
      {cxpAtrasadas.length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Cuentas por pagar de meses anteriores sin pagar ({L(cxpAtrasadas.reduce((s, c) => s + (Number(c.monto) || 0), 0))})</div>
        {cxpAtrasadas.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}><span>{c.descripcion} <span style={{ color: GRIS }}>({c.mes_correspondiente})</span></span><b style={{ color: AMARILLO }}>{L(c.monto)}</b></div>)}
        <div style={{ fontSize: 11, color: GRIS, marginTop: 4 }}>Se pagan desde Finanzas → Cuentas por pagar. Al pagarlas, el gasto sigue contando en su mes.</div>
      </div>}
      {(repetidos.length > 0 || compRepetidos.length > 0) && <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: ROJO }}>Registros repetidos (inflan deudas o ingresos)</div>
        {repetidos.map(({ f }) => <div key={f.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>Cobro repetido: <b>{alPorId[f.alumno_id]?.nombre || "—"}</b>, {f.mes_correspondiente} {anioDe(f)} ({f.numero_factura}, {L(f.monto_total)})</div>)}
        {compRepetidos.map((v) => <div key={v[0].id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>Pago guardado {v.length} veces: <b>{alPorId[v[0].alumno_id]?.nombre || "—"}</b>, {v[0].mes_correspondiente} ({v[0].numero_factura}, {L(v[0].monto_total)} c/u; {L(v[0].monto_total * (v.length - 1))} de más)</div>)}
        <div style={{ fontSize: 11, color: GRIS, marginTop: 4 }}>Hay que anular las copias. Estas alertas no las cuentan dos veces en "Quién debe".</div>
      </div>}
    </div>}
  </div>);
}
