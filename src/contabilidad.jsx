// ════════════════════════════════════════════════════════════
//  CONTABILIDAD (partida doble)
//  Los asientos se generan solos en la base de datos (función contab_generar)
//  leyendo cobros, pagos, gastos, cuentas por pagar, materiales, graduación e
//  ingresos extra. Esta pantalla NO cambia cómo se cobra a los padres.
//  Arranca el 1 de noviembre de 2026. Un mes cerrado queda bloqueado.
// ════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { card, input, label, badge, btn, btnO } from "./estilo";
import { BookOpen, Lock, Unlock, RefreshCw, Info, CheckCircle, AlertTriangle } from "lucide-react";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ARRANQUE = { anio: 2026, mes: 11 };
const GRIS = "#64748B", ROJO = "#DC2626", VERDE = "#059669", AZUL = "#2563EB";
const L = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; const t = `L ${Math.abs(v).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return v < 0 ? `(${t})` : t; };
const clave = (a, m) => a * 12 + m;
const th = { textAlign: "left", padding: "7px 8px", fontSize: 11, color: GRIS, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "2px solid #E2E8F0" };
const td = { padding: "6px 8px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, verticalAlign: "top" };
const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

// Lista de meses desde el arranque hasta el mes actual
const mesesDisponibles = () => {
  const hoy = new Date(); const fin = clave(hoy.getFullYear(), hoy.getMonth() + 1); const r = [];
  for (let k = clave(ARRANQUE.anio, ARRANQUE.mes); k <= fin; k++) r.push({ anio: Math.floor((k - 1) / 12), mes: ((k - 1) % 12) + 1 });
  return r.reverse();
};

// ── Saldos sugeridos al 31 de octubre (para el asiento de apertura) ──
function saldosSugeridos(data) {
  const corte = "2026-10-31", desde = clave(2026, 7);
  const anioF = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4));
  const mesN = (t) => MESES.indexOf(t) + 1;
  // Pagos guardados hasta el 31 de octubre, por cobro
  const pagadoAntes = new Set((data.facturas || []).filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.fecha_pago && f.fecha_pago <= corte).map((f) => f.cobro_id));
  const vistos = new Set(); let cxc = 0;
  (data.facturas || []).filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada").forEach((f) => {
    const k = clave(anioF(f), mesN(f.mes_correspondiente)); if (k < desde || k > clave(2026, 10)) return;
    const u = `${f.alumno_id}|${k}`; if (vistos.has(u)) return; vistos.add(u);
    if (!pagadoAntes.has(f.id)) cxc += Number(f.monto_total) || 0;
  });
  let cxp = 0, sal = 0;
  (data.cuentas_por_pagar || []).forEach((c) => {
    const k = clave(Number(c.anio_correspondiente) || 2026, mesN(c.mes_correspondiente)); if (k > clave(2026, 10)) return;
    if (c.pagada && c.fecha_pago && c.fecha_pago <= corte) return;
    if (c.tipo === "salario") sal += Number(c.monto) || 0; else cxp += Number(c.monto) || 0;
  });
  const recibido = (v) => (Number(v.abonado) > 0 ? Number(v.abonado) : v.estado === "pagado" ? Number(v.precio_venta) || 0 : 0);
  const gradCob = (data.cobros_graduacion || []).filter((v) => ["pagado", "abonado"].includes(v.estado) && v.fecha_pago && v.fecha_pago <= corte).reduce((s, v) => s + recibido(v), 0);
  const gradGas = (data.gastos_graduacion || []).filter((g) => g.fecha && g.fecha <= corte).reduce((s, g) => s + (Number(g.monto) || 0), 0);
  return { cxc, cxp, sal, fondo: Math.max(0, gradCob - gradGas) };
}

export function ContabilidadPage({ data, showToast }) {
  const meses = useMemo(mesesDisponibles, []);
  const [sel, setSel] = useState(meses[0] || ARRANQUE); // el más reciente
  const [tab, setTab] = useState("resultados");
  const [cuentas, setCuentas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [asientos, setAsientos] = useState([]); // todos los asientos con sus líneas
  const [cargando, setCargando] = useState(true);
  const [sinModulo, setSinModulo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [c, p, a] = await Promise.all([
      supabase.from("contab_cuentas").select("*").order("codigo"),
      supabase.from("contab_periodos").select("*"),
      supabase.from("contab_asientos").select("*, contab_lineas(*)").order("fecha").order("id"),
    ]);
    if (c.error) { setSinModulo(true); setCargando(false); return; }
    setCuentas(c.data || []); setPeriodos(p.data || []); setAsientos(a.data || []); setCargando(false);
  }, []);

  const periodo = periodos.find((p) => p.anio === sel.anio && p.mes === sel.mes);
  const cerrado = periodo?.estado === "cerrado";

  // Al abrir un mes abierto, se vuelven a generar sus asientos para que estén al día
  const generar = useCallback(async (aviso) => {
    setTrabajando(true);
    const { error } = await supabase.rpc("contab_generar", { p_anio: sel.anio, p_mes: sel.mes });
    setTrabajando(false);
    if (error) { if (aviso) showToast("Error: " + error.message, "error"); return; }
    await cargar(); if (aviso) showToast("✓ Asientos actualizados");
  }, [sel, cargar, showToast]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!cargando && !sinModulo && !cerrado) generar(false); /* eslint-disable-next-line */ }, [sel.anio, sel.mes, sinModulo, cerrado]);

  const nombreCta = (c) => cuentas.find((x) => x.codigo === c)?.nombre || c;
  const tipoCta = (c) => cuentas.find((x) => x.codigo === c)?.tipo;
  const kSel = clave(sel.anio, sel.mes);
  const delMes = asientos.filter((a) => a.anio === sel.anio && a.mes === sel.mes);
  const hasta = asientos.filter((a) => clave(a.anio, a.mes) <= kSel);
  const lineasDe = (lista) => lista.flatMap((a) => (a.contab_lineas || []).map((l) => ({ ...l, a })));
  const sumaPor = (lineas) => { const m = {}; lineas.forEach((l) => { m[l.cuenta] = (m[l.cuenta] || 0) + Number(l.debe) - Number(l.haber); }); return m; };
  const movMes = sumaPor(lineasDe(delMes));
  const saldos = sumaPor(lineasDe(hasta));
  const hayApertura = asientos.some((a) => a.clase === "apertura");

  // Estado de resultados del mes
  const ingresos = cuentas.filter((c) => c.tipo === "ingreso").map((c) => ({ c, v: -(movMes[c.codigo] || 0) })).filter((x) => Math.abs(x.v) > 0.004);
  const gastos = cuentas.filter((c) => c.tipo === "gasto").map((c) => ({ c, v: movMes[c.codigo] || 0 })).filter((x) => Math.abs(x.v) > 0.004);
  const totIng = ingresos.reduce((s, x) => s + x.v, 0), totGas = gastos.reduce((s, x) => s + x.v, 0), resultado = totIng - totGas;

  // Balance general al final del mes (los resultados de los meses se suman al patrimonio)
  const resAcum = cuentas.filter((c) => c.tipo === "ingreso" || c.tipo === "gasto").reduce((s, c) => s - (saldos[c.codigo] || 0), 0);
  const filasB = (tipo, signo) => cuentas.filter((c) => c.tipo === tipo).map((c) => ({ c, v: signo * (saldos[c.codigo] || 0) })).filter((x) => Math.abs(x.v) > 0.004);
  const activos = filasB("activo", 1), pasivos = filasB("pasivo", -1), patrimonio = filasB("patrimonio", -1);
  const totA = activos.reduce((s, x) => s + x.v, 0), totP = pasivos.reduce((s, x) => s + x.v, 0), totPat = patrimonio.reduce((s, x) => s + x.v, 0) + resAcum;

  // Flujo de efectivo del mes (cuenta 1.1.01)
  const lineasDisp = lineasDe(delMes).filter((l) => l.cuenta === "1.1.01");
  const entradas = lineasDisp.reduce((s, l) => s + Number(l.debe), 0), salidas = lineasDisp.reduce((s, l) => s + Number(l.haber), 0);
  const dispFinal = saldos["1.1.01"] || 0, dispInicial = dispFinal - entradas + salidas;

  const Pest = ({ id, txt }) => <button onClick={() => setTab(id)} style={{ ...btnO, background: tab === id ? "#1E293B" : btnO.background, color: tab === id ? "#fff" : btnO.color, fontWeight: 700 }}>{txt}</button>;

  if (sinModulo) return <div style={card}><h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Falta activar la contabilidad</h3><p style={{ fontSize: 13, color: GRIS }}>Hay que correr <code>supabase/contabilidad.sql</code> en Supabase (SQL Editor). Solo crea tablas nuevas; no cambia nada de lo que ya existe.</p></div>;

  return (<div>
    <div style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(239,246,255,.75)" }}>
      <Info size={18} color={AZUL} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 12.5, color: "#1E3A8A", lineHeight: 1.5 }}>
        <b>Contabilidad</b> registra lo que pasó, en partida doble, y se llena sola con los cobros, pagos y gastos que ya registras. No se edita a mano.
        Empieza el 1 de noviembre de 2026; julio a octubre quedan como historial. Un mes cerrado ya no cambia.
      </div>
    </div>

    <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><label style={label}>Mes</label>
        <select value={`${sel.anio}-${sel.mes}`} onChange={(e) => { const [a, m] = e.target.value.split("-").map(Number); setSel({ anio: a, mes: m }); }} style={{ ...input, width: "auto", cursor: "pointer" }}>
          {meses.map((m) => { const p = periodos.find((x) => x.anio === m.anio && x.mes === m.mes); return <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>{MESES[m.mes - 1]} {m.anio}{p?.estado === "cerrado" ? " (cerrado)" : ""}</option>; })}
        </select></div>
      <span style={badge(cerrado ? GRIS : VERDE)}>{cerrado ? <><Lock size={11} /> Cerrado</> : "Abierto"}</span>
      {!cerrado && <button onClick={() => generar(true)} disabled={trabajando} style={{ ...btnO, opacity: trabajando ? 0.6 : 1 }}><RefreshCw size={14} />{trabajando ? "Actualizando…" : "Actualizar asientos"}</button>}
      {!hayApertura && <span style={{ ...badge(ROJO) }}>Falta el asiento de apertura</span>}
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <Pest id="resultados" txt="Estado de resultados" /><Pest id="balance" txt="Balance general" /><Pest id="flujo" txt="Flujo de efectivo" />
      <Pest id="diario" txt="Libro diario" /><Pest id="mayor" txt="Libro mayor" /><Pest id="cierre" txt="Cierre de mes" /><Pest id="apertura" txt="Apertura" /><Pest id="catalogo" txt="Catálogo" />
    </div>

    {cargando ? <div style={card}><p style={{ fontSize: 13, color: GRIS }}>Cargando…</p></div> : <>
      {tab === "resultados" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Estado de resultados — {MESES[sel.mes - 1]} {sel.anio}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 12px" }}>Lo ganado y lo gastado <b>del mes</b>, aunque se cobre o se pague en otro mes.</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Ingresos</td></tr>
          {ingresos.map((x) => <tr key={x.c.codigo}><td style={{ ...td, paddingLeft: 22 }}>{x.c.nombre}</td><td style={tdR}>{L(x.v)}</td></tr>)}
          <tr><td style={{ ...td, fontWeight: 700 }}>Total ingresos</td><td style={{ ...tdR, fontWeight: 700, color: VERDE }}>{L(totIng)}</td></tr>
          <tr><td style={{ ...td, fontWeight: 700, paddingTop: 12 }} colSpan={2}>Gastos y costos</td></tr>
          {gastos.map((x) => <tr key={x.c.codigo}><td style={{ ...td, paddingLeft: 22 }}>{x.c.nombre}</td><td style={tdR}>{L(x.v)}</td></tr>)}
          <tr><td style={{ ...td, fontWeight: 700 }}>Total gastos</td><td style={{ ...tdR, fontWeight: 700, color: ROJO }}>{L(totGas)}</td></tr>
          <tr><td style={{ ...td, fontWeight: 800, fontSize: 14, borderTop: "2px solid #1E293B" }}>{resultado >= 0 ? "Ganancia del mes" : "Pérdida del mes"}</td><td style={{ ...tdR, fontWeight: 800, fontSize: 14, borderTop: "2px solid #1E293B", color: resultado >= 0 ? VERDE : ROJO }}>{L(resultado)}</td></tr>
        </tbody></table>
        {!data.cuentas_por_pagar?.some((c) => c.tipo === "renta" && MESES.indexOf(c.mes_correspondiente) + 1 === sel.mes && (Number(c.anio_correspondiente) || sel.anio) === sel.anio) && !gastos.some((x) => x.c.codigo === "5.2.02") &&
          <div style={{ marginTop: 12, fontSize: 12, color: "#92400E", background: "#FEF3C7", padding: "8px 10px", borderRadius: 10, display: "flex", gap: 6 }}><AlertTriangle size={14} />La renta de {MESES[sel.mes - 1]} todavía no está registrada. Regístrala en Finanzas → Cuentas por pagar con mes {MESES[sel.mes - 1]} (aunque se pague el mes siguiente), para que este resultado sea real.</div>}
      </div>}

      {tab === "balance" && <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Balance general al {new Date(sel.anio, sel.mes, 0).getDate()} de {MESES[sel.mes - 1]} {sel.anio}</h3>
        <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 12px" }}>Lo que la escuela tiene, lo que debe y lo que es de la propietaria.</p>
        <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 800 ? "1fr 1fr" : "1fr", gap: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
            <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Activos (lo que tengo)</td></tr>
            {activos.map((x) => <tr key={x.c.codigo}><td style={{ ...td, paddingLeft: 22 }}>{x.c.nombre}</td><td style={tdR}>{L(x.v)}</td></tr>)}
            <tr><td style={{ ...td, fontWeight: 800, borderTop: "2px solid #1E293B" }}>Total activos</td><td style={{ ...tdR, fontWeight: 800, borderTop: "2px solid #1E293B" }}>{L(totA)}</td></tr>
          </tbody></table>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
            <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Pasivos (lo que debo)</td></tr>
            {pasivos.map((x) => <tr key={x.c.codigo}><td style={{ ...td, paddingLeft: 22 }}>{x.c.nombre}</td><td style={tdR}>{L(x.v)}</td></tr>)}
            <tr><td style={{ ...td, fontWeight: 700 }}>Total pasivos</td><td style={{ ...tdR, fontWeight: 700 }}>{L(totP)}</td></tr>
            <tr><td style={{ ...td, fontWeight: 700, paddingTop: 12 }} colSpan={2}>Patrimonio</td></tr>
            {patrimonio.map((x) => <tr key={x.c.codigo}><td style={{ ...td, paddingLeft: 22 }}>{x.c.nombre}</td><td style={tdR}>{L(x.v)}</td></tr>)}
            <tr><td style={{ ...td, paddingLeft: 22 }}>Resultados desde noviembre 2026</td><td style={tdR}>{L(resAcum)}</td></tr>
            <tr><td style={{ ...td, fontWeight: 700 }}>Total patrimonio</td><td style={{ ...tdR, fontWeight: 700 }}>{L(totPat)}</td></tr>
            <tr><td style={{ ...td, fontWeight: 800, borderTop: "2px solid #1E293B" }}>Pasivos + patrimonio</td><td style={{ ...tdR, fontWeight: 800, borderTop: "2px solid #1E293B" }}>{L(totP + totPat)}</td></tr>
          </tbody></table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 6, alignItems: "center", color: Math.abs(totA - totP - totPat) < 0.01 ? VERDE : ROJO }}>
          {Math.abs(totA - totP - totPat) < 0.01 ? <><CheckCircle size={14} />Cuadra: activos = pasivos + patrimonio.</> : <><AlertTriangle size={14} />No cuadra por {L(totA - totP - totPat)}.</>}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#1E3A8A", background: "#EFF6FF", padding: "8px 10px", borderRadius: 10 }}>
          <b>Dinero libre</b> = efectivo y bancos − lo que debo a proveedores y salarios = {L((saldos["1.1.01"] || 0) + (saldos["2.1.01"] || 0) + (saldos["2.1.02"] || 0))}. Si es negativo, ese dinero ya tiene dueño.
        </div>
      </div>}

      {tab === "flujo" && <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Flujo de efectivo — {MESES[sel.mes - 1]} {sel.anio}</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          <tr><td style={td}>Efectivo y bancos al iniciar el mes</td><td style={tdR}>{L(dispInicial)}</td></tr>
          <tr><td style={td}>(+) Entradas de dinero</td><td style={{ ...tdR, color: VERDE }}>{L(entradas)}</td></tr>
          <tr><td style={td}>(−) Salidas de dinero</td><td style={{ ...tdR, color: ROJO }}>{L(-salidas)}</td></tr>
          <tr><td style={{ ...td, fontWeight: 800, borderTop: "2px solid #1E293B" }}>Efectivo y bancos al cierre</td><td style={{ ...tdR, fontWeight: 800, borderTop: "2px solid #1E293B" }}>{L(dispFinal)}</td></tr>
        </tbody></table>
        <p style={{ fontSize: 11.5, color: GRIS, marginTop: 10 }}>El flujo cuenta el dinero por la fecha real en que entró o salió. Por eso puede ser distinto de la ganancia del mes.</p>
      </div>}

      {tab === "diario" && <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Libro diario — {MESES[sel.mes - 1]} {sel.anio} ({delMes.length} asientos)</h3>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Fecha</th><th style={th}>Concepto / cuenta</th><th style={{ ...th, textAlign: "right" }}>Debe</th><th style={{ ...th, textAlign: "right" }}>Haber</th></tr></thead>
          <tbody>{delMes.map((a) => [
            <tr key={a.id}><td style={{ ...td, whiteSpace: "nowrap", color: GRIS }}>{String(a.fecha).split("-").reverse().join("/")}</td><td style={{ ...td, fontWeight: 600 }} colSpan={3}>{a.descripcion} {a.clase !== "auto" && <span style={badge(AZUL)}>{a.clase}</span>}</td></tr>,
            ...(a.contab_lineas || []).map((l) => <tr key={a.id + "-" + l.id}><td style={{ ...td, borderBottom: "none" }} /><td style={{ ...td, borderBottom: "none", paddingLeft: Number(l.haber) > 0 ? 34 : 14, color: "#334155" }}>{l.cuenta} {nombreCta(l.cuenta)}</td><td style={{ ...tdR, borderBottom: "none" }}>{Number(l.debe) ? L(l.debe) : ""}</td><td style={{ ...tdR, borderBottom: "none" }}>{Number(l.haber) ? L(l.haber) : ""}</td></tr>),
          ])}</tbody>
        </table></div>
      </div>}

      {tab === "mayor" && <Mayor cuentas={cuentas} asientos={hasta} nombreCta={nombreCta} tipoCta={tipoCta} sel={sel} />}
      {tab === "cierre" && <Cierre sel={sel} periodo={periodo} saldoDisp={saldos["1.1.01"] || 0} hayApertura={hayApertura} recargar={cargar} showToast={showToast} resultado={resultado} />}
      {tab === "apertura" && <Apertura data={data} asientos={asientos} recargar={cargar} showToast={showToast} periodos={periodos} />}
      {tab === "catalogo" && <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Catálogo de cuentas</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={th}>Código</th><th style={th}>Cuenta</th><th style={th}>Tipo</th><th style={th}>Para qué</th></tr></thead>
          <tbody>{cuentas.map((c) => <tr key={c.codigo}><td style={td}>{c.codigo}</td><td style={{ ...td, fontWeight: 600 }}>{c.nombre}</td><td style={td}>{c.tipo}</td><td style={{ ...td, color: GRIS }}>{c.descripcion || ""}</td></tr>)}</tbody></table>
      </div>}
    </>}
  </div>);
}

function Mayor({ cuentas, asientos, nombreCta, tipoCta, sel }) {
  const [cta, setCta] = useState("1.1.01");
  const signo = ["activo", "gasto"].includes(tipoCta(cta)) ? 1 : -1;
  let saldo = 0;
  const filas = asientos.flatMap((a) => (a.contab_lineas || []).filter((l) => l.cuenta === cta).map((l) => ({ a, l })));
  return (<div style={card}>
    <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>Libro mayor hasta {MESES[sel.mes - 1]} {sel.anio}</h3>
      <select value={cta} onChange={(e) => setCta(e.target.value)} style={{ ...input, width: "auto", cursor: "pointer" }}>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} {c.nombre}</option>)}</select>
    </div>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr><th style={th}>Fecha</th><th style={th}>Concepto</th><th style={{ ...th, textAlign: "right" }}>Debe</th><th style={{ ...th, textAlign: "right" }}>Haber</th><th style={{ ...th, textAlign: "right" }}>Saldo</th></tr></thead>
      <tbody>{filas.length === 0 ? <tr><td style={td} colSpan={5}>Sin movimientos en {nombreCta(cta)}</td></tr> : filas.map(({ a, l }) => { saldo += signo * (Number(l.debe) - Number(l.haber)); return (
        <tr key={l.id}><td style={{ ...td, whiteSpace: "nowrap", color: GRIS }}>{String(a.fecha).split("-").reverse().join("/")}</td><td style={td}>{a.descripcion}</td><td style={tdR}>{Number(l.debe) ? L(l.debe) : ""}</td><td style={tdR}>{Number(l.haber) ? L(l.haber) : ""}</td><td style={{ ...tdR, fontWeight: 700 }}>{L(saldo)}</td></tr>); })}</tbody>
    </table></div>
  </div>);
}

function Cierre({ sel, periodo, saldoDisp, hayApertura, recargar, showToast, resultado }) {
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const cerrado = periodo?.estado === "cerrado";
  const dif = contado === "" ? null : Math.round((parseFloat(contado) - saldoDisp) * 100) / 100;
  const cerrar = async () => {
    if (!hayApertura) { showToast("Primero registra el asiento de apertura", "error"); return; }
    if (contado === "" || isNaN(parseFloat(contado))) { showToast("Escribe cuánto dinero hay realmente (efectivo + banco)", "error"); return; }
    if (dif !== 0 && !notas.trim()) { showToast("Hay diferencia: explica en las notas qué pasó", "error"); return; }
    if (!confirm(`¿Cerrar ${MESES[sel.mes - 1]} ${sel.anio}? Después ya no se podrá modificar.`)) return;
    const { error } = await supabase.rpc("contab_cerrar", { p_anio: sel.anio, p_mes: sel.mes, p_dinero: parseFloat(contado), p_notas: notas.trim() || null });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast(`✓ ${MESES[sel.mes - 1]} cerrado`);
  };
  const reabrir = async () => {
    if (!confirm(`¿Reabrir ${MESES[sel.mes - 1]} ${sel.anio}? Úsalo solo para corregir un error.`)) return;
    const { error } = await supabase.rpc("contab_reabrir", { p_anio: sel.anio, p_mes: sel.mes });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast("Mes reabierto");
  };
  if (cerrado) return (<div style={card}>
    <h3 style={{ margin: "0 0 8px", fontSize: 15, display: "flex", gap: 6, alignItems: "center" }}><Lock size={16} />{MESES[sel.mes - 1]} {sel.anio} está cerrado</h3>
    <p style={{ fontSize: 13, color: GRIS }}>Cerrado el {new Date(periodo.cerrado_en).toLocaleString("es-HN")} por {periodo.cerrado_por || "—"}. Dinero contado: {L(periodo.dinero_contado)}.{periodo.notas ? ` Notas: ${periodo.notas}` : ""}</p>
    <p style={{ fontSize: 12, color: GRIS }}>Si aparece algo de este mes después del cierre, se registra en el mes abierto. Solo reabre para corregir un error.</p>
    <button onClick={reabrir} style={btnO}><Unlock size={14} />Reabrir mes</button>
  </div>);
  const paso = (ok, txt) => <li style={{ fontSize: 13, margin: "6px 0", color: ok ? VERDE : "#334155" }}>{ok ? "✓ " : "○ "}{txt}</li>;
  return (<div style={card}>
    <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Cierre de {MESES[sel.mes - 1]} {sel.anio}</h3>
    <ol style={{ paddingLeft: 18, margin: "0 0 14px" }}>
      {paso(hayApertura, "Asiento de apertura registrado (pestaña Apertura).")}
      {paso(false, `Registrar lo que se debe del mes aunque no esté pagado: renta, luz, internet, salarios (Finanzas → Cuentas por pagar, mes ${MESES[sel.mes - 1]}).`)}
      {paso(false, "Contar el efectivo y revisar el saldo del banco; escribir la suma abajo.")}
      {paso(dif === 0, "Si hay diferencia, buscarla. Si no aparece, registrarla en Finanzas → Cerrar mes (ajuste de caja) y explicarla en las notas.")}
      {paso(false, "Revisar el estado de resultados y el balance, y cerrar.")}
    </ol>
    <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 700 ? "1fr 1fr" : "1fr", gap: 12 }}>
      <div><label style={label}>Dinero real hoy (efectivo + banco)</label><input type="number" value={contado} onChange={(e) => setContado(e.target.value)} style={input} />
        <div style={{ fontSize: 12, marginTop: 4, color: GRIS }}>Según la contabilidad: <b>{L(saldoDisp)}</b>{dif !== null && <> · Diferencia: <b style={{ color: dif === 0 ? VERDE : ROJO }}>{L(dif)}</b></>}</div></div>
      <div><label style={label}>Notas del cierre</label><input value={notas} onChange={(e) => setNotas(e.target.value)} style={input} placeholder="Ej. faltan L 50 de vuelto" /></div>
    </div>
    <div style={{ marginTop: 10, fontSize: 12.5 }}>Resultado del mes: <b style={{ color: resultado >= 0 ? VERDE : ROJO }}>{L(resultado)}</b></div>
    <button onClick={cerrar} style={{ ...btn("#1E293B"), marginTop: 14 }}><Lock size={14} />Cerrar {MESES[sel.mes - 1]}</button>
  </div>);
}

function Apertura({ data, asientos, recargar, showToast, periodos }) {
  const sug = useMemo(() => saldosSugeridos(data), [data]);
  const actual = asientos.find((a) => a.clase === "apertura");
  const deActual = (cta, lado) => { const l = (actual?.contab_lineas || []).find((x) => x.cuenta === cta); return l ? String(Number(l[lado])) : ""; };
  const [f, setF] = useState(() => ({
    disp: deActual("1.1.01", "debe"),
    cxc: deActual("1.2.01", "debe") || String(sug.cxc),
    cxp: deActual("2.1.01", "haber") || String(sug.cxp),
    sal: deActual("2.1.02", "haber") || String(sug.sal),
    prest: deActual("2.2.01", "haber"),
    deuda: deActual("2.2.02", "haber"),
    fondo: deActual("2.3.01", "haber") || String(sug.fondo),
  }));
  const n = (k) => parseFloat(f[k]) || 0;
  const activos = n("disp") + n("cxc"), pasivos = n("cxp") + n("sal") + n("prest") + n("deuda") + n("fondo");
  const capital = activos - pasivos;
  const novCerrado = periodos.some((p) => p.anio === 2026 && p.mes === 11 && p.estado === "cerrado");
  const guardar = async () => {
    if (f.disp === "") { showToast("Escribe cuánto dinero había al 31 de octubre", "error"); return; }
    const lineas = [["1.1.01", n("disp"), 0], ["1.2.01", n("cxc"), 0], ["2.1.01", 0, n("cxp")], ["2.1.02", 0, n("sal")], ["2.2.01", 0, n("prest")], ["2.2.02", 0, n("deuda")], ["2.3.01", 0, n("fondo")],
      capital >= 0 ? ["3.1.01", 0, capital] : ["3.1.01", -capital, 0]];
    const { error } = await supabase.rpc("contab_registrar", { p_fecha: "2026-11-01", p_descripcion: "Saldos de apertura al 31 de octubre de 2026", p_clase: "apertura", p_lineas: lineas });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast("✓ Apertura guardada");
  };
  const campo = (k, t, ayuda) => <div><label style={label}>{t}</label><input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={input} disabled={novCerrado} />{ayuda && <div style={{ fontSize: 10.5, color: GRIS, marginTop: 3 }}>{ayuda}</div>}</div>;
  return (<div style={card}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Saldos de apertura (31 de octubre de 2026)</h3>
    <p style={{ fontSize: 12, color: GRIS, margin: "0 0 14px" }}>Es la foto de lo que la escuela tenía y debía al terminar octubre. Los valores sugeridos salen de tus registros; corrígelos si sabes el dato real.</p>
    <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 700 ? "1fr 1fr" : "1fr", gap: 12 }}>
      {campo("disp", "Efectivo y bancos (dinero real contado)", "Obligatorio: lo que había en caja y en el banco.")}
      {campo("cxc", "Lo que debían los padres (julio a octubre)", `Sugerido ${L(sug.cxc)}: mensualidades de julio a octubre sin pagar al 31/10, sin repetidos.`)}
      {campo("cxp", "Proveedores y servicios por pagar", `Sugerido ${L(sug.cxp)}: cuentas por pagar de octubre o antes.`)}
      {campo("sal", "Salarios por pagar", `Sugerido ${L(sug.sal)}.`)}
      {campo("prest", "Préstamo de la propietaria (lo que se le debe)", "Lo que aún falta devolverte.")}
      {campo("deuda", "Otras deudas anteriores", "Si queda algo de la deuda de antes de julio.")}
      {campo("fondo", "Fondo de graduación sin gastar", `Sugerido ${L(sug.fondo)}: cobrado menos gastado. Pon 0 si el evento ya pasó y el sobrante es de la escuela.`)}
    </div>
    <div style={{ marginTop: 14, fontSize: 13, background: "#F8FAFC", padding: "10px 12px", borderRadius: 12 }}>
      Activos {L(activos)} − Pasivos {L(pasivos)} = <b>Capital {L(capital)}</b> (lo que es de la escuela/propietaria al arrancar).
    </div>
    {novCerrado ? <p style={{ fontSize: 12, color: GRIS }}>Noviembre ya está cerrado; la apertura no se puede cambiar.</p> :
      <button onClick={guardar} style={{ ...btn(AZUL), marginTop: 14 }}><BookOpen size={14} />{actual ? "Actualizar apertura" : "Guardar apertura"}</button>}
  </div>);
}
