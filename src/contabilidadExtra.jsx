// ════════════════════════════════════════════════════════════
//  CONTABILIDAD: reportes y herramientas de contador
//  · Balanza de comprobación (saldos de todas las cuentas: debe = haber)
//  · Asientos de ajuste (correcciones a mano, en partida doble)
//  · Antigüedad de saldos: lo que deben los padres y lo que debe la escuela
//  Solo lee datos, salvo los asientos de ajuste, que se guardan con la misma
//  función contab_registrar que ya usa la apertura. NO cambia cobros a padres.
// ════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { card, input, label, btn, btnO } from "./estilo";
import { Plus, Trash2, CheckCircle, AlertTriangle, BookOpen } from "lucide-react";
import { Titular, Kpis, Desglose, Hoja, Lc, L, VERDE, ROJO, NARANJA, AZUL, GRIS } from "./vistas";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const clave = (a, m) => a * 12 + m;
const fechaC = (f) => String(f || "").split("-").reverse().join("/");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const finMes = (a, m) => `${a}-${String(m).padStart(2, "0")}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;

// ── Balanza de comprobación de un mes ──
// Por cuenta: saldo al iniciar el mes, lo cargado (debe) y abonado (haber) en el mes y el saldo final.
export function calcularBalanza(cuentas, asientos, anio, mes) {
  const k = clave(anio, mes);
  const m = {};
  cuentas.forEach((c) => { m[c.codigo] = { c, ini: 0, debe: 0, haber: 0 }; });
  asientos.forEach((a) => {
    const ka = clave(a.anio, a.mes); if (ka > k) return;
    (a.contab_lineas || []).forEach((l) => {
      const x = m[l.cuenta] || (m[l.cuenta] = { c: { codigo: l.cuenta, nombre: l.cuenta, tipo: "" }, ini: 0, debe: 0, haber: 0 });
      if (ka < k) x.ini += Number(l.debe) - Number(l.haber);
      else { x.debe += Number(l.debe); x.haber += Number(l.haber); }
    });
  });
  const filas = Object.values(m).map((x) => ({ ...x, fin: r2(x.ini + x.debe - x.haber) }))
    .filter((x) => Math.abs(x.ini) > 0.004 || x.debe > 0.004 || x.haber > 0.004)
    .sort((a, b) => a.c.codigo.localeCompare(b.c.codigo, undefined, { numeric: true }));
  const t = filas.reduce((s, x) => ({
    iniD: s.iniD + Math.max(0, x.ini), iniH: s.iniH + Math.max(0, -x.ini),
    debe: s.debe + x.debe, haber: s.haber + x.haber,
    finD: s.finD + Math.max(0, x.fin), finH: s.finH + Math.max(0, -x.fin),
  }), { iniD: 0, iniH: 0, debe: 0, haber: 0, finD: 0, finH: 0 });
  return { filas, t, cuadra: Math.abs(t.debe - t.haber) < 0.01 && Math.abs(t.finD - t.finH) < 0.01 };
}

export function Balanza({ cuentas, asientos, sel, vista }) {
  const { filas, t, cuadra } = useMemo(() => calcularBalanza(cuentas, asientos, sel.anio, sel.mes), [cuentas, asientos, sel.anio, sel.mes]);
  const mesTxt = `${MESES[sel.mes - 1]} ${sel.anio}`;
  const TIPOS = [["activo", "Lo que tiene (activos)", AZUL], ["pasivo", "Lo que debe (pasivos)", NARANJA], ["patrimonio", "De la propietaria (patrimonio)", AZUL], ["ingreso", "Ingresos", VERDE], ["gasto", "Gastos", NARANJA]];
  const signo = (tipo) => (["activo", "gasto"].includes(tipo) ? 1 : -1);
  return (<div style={card}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Balanza de comprobación — {mesTxt}</h3>
    <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>La revisión que hace todo contador antes de cerrar: cada cuenta con su saldo. Si las sumas del debe y del haber son iguales, la contabilidad está bien anotada.</p>
    {vista === "sencilla" ? <>
      <Titular sub={`${filas.length} cuentas con movimiento hasta ${mesTxt}.`}>{cuadra ? <>La contabilidad <span style={{ color: VERDE }}>cuadra</span>: todo lo que entra a una cuenta sale de otra.</> : <>Ojo: la balanza <span style={{ color: ROJO }}>no cuadra</span> por {Lc(t.debe - t.haber)}.</>}</Titular>
      <Kpis items={[
        { t: "Anotado al debe en el mes", v: Lc(t.debe), color: AZUL },
        { t: "Anotado al haber en el mes", v: Lc(t.haber), color: AZUL },
        { t: "Diferencia", v: Lc(t.debe - t.haber), color: cuadra ? VERDE : ROJO, dest: true, s: cuadra ? "Debe ser cero, y lo es" : "Tiene que ser cero" },
      ]} />
      <div className="vn-dos">
        {TIPOS.map(([tipo, titulo, color]) => { const xs = filas.filter((x) => x.c.tipo === tipo); return xs.length === 0 ? null :
          <Desglose key={tipo} titulo={titulo} color={color} items={xs.map((x) => ({ t: `${x.c.codigo} ${x.c.nombre}`, v: signo(tipo) * x.fin, d: tipo === "ingreso" || tipo === "gasto" ? "Acumulado desde noviembre 2026" : "Saldo al final del mes" }))} />; })}
      </div>
    </> : <Hoja minWidth={820} sangria={false} columnas={[{ t: "Código", ancho: 70 }, { t: "Cuenta" }, { t: "Saldo inicial deudor", num: true, ancho: 120 }, { t: "Saldo inicial acreedor", num: true, ancho: 120 }, { t: "Debe del mes", num: true, ancho: 115 }, { t: "Haber del mes", num: true, ancho: 115 }, { t: "Saldo final deudor", num: true, ancho: 120 }, { t: "Saldo final acreedor", num: true, ancho: 120 }]} filas={[
      ...TIPOS.flatMap(([tipo, titulo]) => { const xs = filas.filter((x) => x.c.tipo === tipo); return xs.length === 0 ? [] : [{ tipo: "sec", c: ["", titulo] },
        ...xs.map((x) => ({ c: [x.c.codigo, x.c.nombre, x.ini > 0.004 ? x.ini : "", x.ini < -0.004 ? -x.ini : "", x.debe || "", x.haber || "", x.fin > 0.004 ? x.fin : "", x.fin < -0.004 ? -x.fin : ""] }))]; }),
      { tipo: "gran", c: ["", "Sumas iguales", t.iniD, t.iniH, t.debe, t.haber, t.finD, t.finH], color: cuadra ? undefined : ROJO },
    ]} pie="Deudor = saldo a favor del debe (activos y gastos). Acreedor = saldo a favor del haber (pasivos, patrimonio e ingresos). Las columnas de cada par deben sumar lo mismo." />}
    <div style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 6, alignItems: "center", color: cuadra ? VERDE : ROJO }}>
      {cuadra ? <><CheckCircle size={14} />Sumas iguales: la balanza cuadra.</> : <><AlertTriangle size={14} />No cuadra: revisa los asientos de ajuste del mes.</>}
    </div>
  </div>);
}

// ── Asientos de ajuste (manuales) ──
// Para lo que un contador corrige a mano: reclasificar un gasto, registrar un faltante,
// un préstamo de la propietaria, un retiro, etc. Siempre en partida doble y solo en meses abiertos.
const EJEMPLOS = [
  { t: "La propietaria prestó dinero a la escuela", l: [["1.1.01", "debe"], ["2.2.01", "haber"]] },
  { t: "La propietaria sacó dinero para ella (retiro)", l: [["3.2.01", "debe"], ["1.1.01", "haber"]] },
  { t: "Se pasó un gasto a la cuenta correcta", l: [["5.2.03", "debe"], ["5.2.05", "haber"]] },
  { t: "Faltó dinero al contar la caja", l: [["5.3.01", "debe"], ["1.1.01", "haber"]] },
];
export function Ajustes({ cuentas, asientos, sel, cerrado, nombreCta, recargar, showToast, vista }) {
  const nuevaLinea = (cuenta = "", lado = "debe") => ({ cuenta, debe: lado === "debe" ? "" : "0", haber: lado === "haber" ? "" : "0" });
  const ini = `${sel.anio}-${String(sel.mes).padStart(2, "0")}-01`, fin = finMes(sel.anio, sel.mes);
  const hoy = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState(() => ({ fecha: hoy >= ini && hoy <= fin ? hoy : fin, descripcion: "", lineas: [nuevaLinea("", "debe"), nuevaLinea("", "haber")] }));
  const [guardando, setGuardando] = useState(false);
  const n = (v) => parseFloat(v) || 0;
  const sumD = r2(f.lineas.reduce((s, l) => s + n(l.debe), 0)), sumH = r2(f.lineas.reduce((s, l) => s + n(l.haber), 0));
  const cuadra = sumD > 0 && Math.abs(sumD - sumH) < 0.005;
  const manuales = asientos.filter((a) => a.anio === sel.anio && a.mes === sel.mes && a.clase === "manual");
  const setLinea = (i, cambio) => setF({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)) });
  const usarEjemplo = (e) => setF({ ...f, descripcion: f.descripcion || e.t, lineas: e.l.map(([c, lado]) => nuevaLinea(c, lado)) });

  const guardar = async () => {
    if (!f.descripcion.trim()) { showToast("Explica el motivo del ajuste", "error"); return; }
    if (f.fecha < ini || f.fecha > fin) { showToast(`La fecha debe ser de ${MESES[sel.mes - 1]} ${sel.anio}`, "error"); return; }
    const lineas = f.lineas.filter((l) => l.cuenta && (n(l.debe) > 0 || n(l.haber) > 0));
    if (lineas.length < 2) { showToast("Un asiento necesita al menos dos cuentas", "error"); return; }
    if (lineas.some((l) => n(l.debe) > 0 && n(l.haber) > 0)) { showToast("Cada línea va al debe o al haber, no a los dos", "error"); return; }
    if (!cuadra) { showToast("El debe y el haber tienen que sumar lo mismo", "error"); return; }
    setGuardando(true);
    const { error } = await supabase.rpc("contab_registrar", { p_fecha: f.fecha, p_descripcion: "Ajuste: " + f.descripcion.trim(), p_clase: "manual", p_lineas: lineas.map((l) => [l.cuenta, r2(n(l.debe)), r2(n(l.haber))]) });
    setGuardando(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setF({ ...f, descripcion: "", lineas: [nuevaLinea("", "debe"), nuevaLinea("", "haber")] });
    await recargar(); showToast("✓ Ajuste guardado");
  };
  const borrar = async (a) => {
    if (!confirm(`¿Borrar el ajuste "${a.descripcion}"?`)) return;
    const { error } = await supabase.from("contab_asientos").delete().eq("id", a.id);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await recargar(); showToast("Ajuste borrado", "error");
  };

  const lista = vista === "sencilla"
    ? (manuales.length === 0 ? <div className="vn-vacio">No hay ajustes en {MESES[sel.mes - 1]}.</div> : manuales.map((a) => {
        const tot = (a.contab_lineas || []).reduce((s, l) => s + Number(l.debe), 0);
        return (<div key={a.id} className="vn-it"><div className="f"><span className="n">{a.descripcion}</span><span className="m">{Lc(tot)}</span></div>
          <div className="d"><span>{fechaC(a.fecha)} · {(a.contab_lineas || []).map((l) => `${Number(l.debe) > 0 ? "sube" : "baja"} ${nombreCta(l.cuenta)}`).join(" · ")}</span>
            {!cerrado && <button onClick={() => borrar(a)} title="Borrar" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Trash2 size={13} color={GRIS} /></button>}</div></div>);
      }))
    : <Hoja minWidth={640} sangria={false} columnas={[{ t: "Fecha", ancho: 82 }, { t: "Concepto / cuenta" }, { t: "Código", ancho: 72 }, { t: "Debe", num: true, ancho: 115 }, { t: "Haber", num: true, ancho: 115 }]} filas={manuales.length === 0 ? [{ c: ["", `No hay ajustes en ${MESES[sel.mes - 1]}`] }] :
        manuales.flatMap((a) => [{ tipo: "sec", c: [fechaC(a.fecha), a.descripcion], onClick: cerrado ? undefined : () => borrar(a) },
          ...(a.contab_lineas || []).map((l) => ({ c: ["", nombreCta(l.cuenta), l.cuenta, Number(l.debe) || "", Number(l.haber) || ""] }))])}
        pie={cerrado ? undefined : "Toca el título de un ajuste para borrarlo."} />;

  return (<div style={card}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Asientos de ajuste — {MESES[sel.mes - 1]} {sel.anio}</h3>
    <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Para corregir o registrar lo que no sale solo de los cobros y gastos: un préstamo de la propietaria, un retiro, un gasto mal clasificado. Siempre en partida doble (lo que sube en una cuenta baja o se compensa en otra). Los asientos automáticos no se tocan.</p>
    {cerrado ? <p style={{ fontSize: 13, color: GRIS }}>Este mes está cerrado: no se pueden agregar ni borrar ajustes. Regístralos en el mes abierto.</p> : <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {EJEMPLOS.map((e) => <button key={e.t} onClick={() => usarEjemplo(e)} style={{ ...btnO, fontSize: 11.5, padding: "4px 9px" }}>{e.t}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 700 ? "160px 1fr" : "1fr", gap: 12, marginBottom: 10 }}>
        <div><label style={label}>Fecha</label><input type="date" min={ini} max={fin} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} style={input} /></div>
        <div><label style={label}>Motivo del ajuste</label><input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} style={input} placeholder="Ej. la luz se anotó como otro gasto" /></div>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
        <thead><tr>{["Cuenta", "Debe (sube activo o gasto)", "Haber (sube pasivo o ingreso)", ""].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 11, color: GRIS, padding: "4px 6px" }}>{h}</th>)}</tr></thead>
        <tbody>{f.lineas.map((l, i) => <tr key={i}>
          <td style={{ padding: 4 }}><select value={l.cuenta} onChange={(e) => setLinea(i, { cuenta: e.target.value })} style={{ ...input, cursor: "pointer" }}>
            <option value="">Elegir cuenta…</option>{cuentas.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} {c.nombre}</option>)}</select></td>
          <td style={{ padding: 4, width: 150 }}><input type="number" min="0" value={l.debe === "0" ? "" : l.debe} onChange={(e) => setLinea(i, { debe: e.target.value, haber: e.target.value ? "0" : l.haber })} style={input} /></td>
          <td style={{ padding: 4, width: 150 }}><input type="number" min="0" value={l.haber === "0" ? "" : l.haber} onChange={(e) => setLinea(i, { haber: e.target.value, debe: e.target.value ? "0" : l.debe })} style={input} /></td>
          <td style={{ padding: 4, width: 30 }}>{f.lineas.length > 2 && <button onClick={() => setF({ ...f, lineas: f.lineas.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={GRIS} /></button>}</td>
        </tr>)}
        <tr><td style={{ padding: "6px 4px", fontSize: 12.5, fontWeight: 700 }}>Sumas</td><td style={{ padding: "6px 8px", fontSize: 12.5, fontWeight: 700 }}>{L(sumD)}</td><td style={{ padding: "6px 8px", fontSize: 12.5, fontWeight: 700 }}>{L(sumH)}</td><td /></tr></tbody>
      </table></div>
      <div style={{ fontSize: 12, margin: "6px 0 12px", color: cuadra ? VERDE : sumD || sumH ? ROJO : GRIS }}>{cuadra ? "✓ Cuadra: se puede guardar." : sumD || sumH ? `Falta ${L(Math.abs(sumD - sumH))} para que cuadre.` : "Escribe los montos."}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <button onClick={() => setF({ ...f, lineas: [...f.lineas, nuevaLinea()] })} style={btnO}><Plus size={14} />Otra cuenta</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btn("#1B2A4A"), opacity: guardando ? 0.6 : 1 }}><BookOpen size={14} />{guardando ? "Guardando…" : "Guardar ajuste"}</button>
      </div>
    </>}
    <h4 style={{ fontSize: 13.5, margin: "4px 0 8px" }}>Ajustes de {MESES[sel.mes - 1]}</h4>
    <div className={vista === "sencilla" ? "vn-caja" : ""}>{lista}</div>
  </div>);
}

// ── Antigüedad de saldos ──
// Lo que deben los padres (mensualidades sin pagar) y lo que debe la escuela (cuentas por pagar),
// agrupado por cuántos días lleva pendiente, como lo revisa un contador cada mes.
const TRAMOS = [["0–30 días", 30], ["31–60 días", 60], ["61–90 días", 90], ["Más de 90 días", Infinity]];
const tramo = (dias) => TRAMOS.findIndex(([, max]) => dias <= max);
const diasEntre = (desde, hasta) => Math.max(0, Math.floor((new Date(hasta + "T12:00:00") - new Date(desde + "T12:00:00")) / 86400000));

export function calcularAntiguedad(data, corte) {
  const anioF = (f) => Number(f.anio_correspondiente) || Number(String(f.fecha_emision || "").slice(0, 4));
  const fac = data.facturas || [];
  const pagados = new Set(fac.filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.cobro_id && (!f.fecha_pago || f.fecha_pago <= corte)).map((f) => f.cobro_id));
  const conComprobante = new Set(fac.filter((f) => f.tipo_factura === "comprobante" && f.estado !== "anulada" && f.cobro_id).map((f) => f.cobro_id));
  const nombre = Object.fromEntries((data.alumnos || []).map((a) => [a.id, a.nombre]));
  // Un cobro por alumno, mes y año (los repetidos no se cuentan dos veces)
  const grupos = {};
  fac.filter((f) => (f.tipo_factura || "cobro") === "cobro" && f.estado !== "anulada" && f.fecha_emision && f.fecha_emision <= corte).forEach((f) => {
    const k = `${f.alumno_id}|${anioF(f)}|${f.mes_correspondiente}`; (grupos[k] || (grupos[k] = [])).push(f);
  });
  const porAlumno = {};
  Object.values(grupos).forEach((lista) => {
    // Pagado antes del corte (comprobante), o marcado pagado sin comprobante guardado
    if (lista.some((f) => pagados.has(f.id) || (f.estado === "pagada" && !conComprobante.has(f.id)))) return;
    const f = lista.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))[0];
    const monto = Number(f.saldo) > 0 && Number(f.saldo) < Number(f.monto_total) ? Number(f.saldo) : Number(f.monto_total) || 0;
    if (monto <= 0) return;
    const t = tramo(diasEntre(f.fecha_emision, corte));
    const x = porAlumno[f.alumno_id] || (porAlumno[f.alumno_id] = { id: f.alumno_id, nombre: nombre[f.alumno_id] || "Alumno sin nombre", tr: [0, 0, 0, 0], total: 0, meses: [] });
    x.tr[t] += monto; x.total += monto; x.meses.push({ t: `${f.mes_correspondiente} ${anioF(f)}`, v: monto });
  });
  const cxc = Object.values(porAlumno).sort((a, b) => b.total - a.total);
  const cxp = (data.cuentas_por_pagar || []).filter((c) => !c.pagada).map((c) => {
    const m = MESES.indexOf(c.mes_correspondiente) + 1, a = Number(c.anio_correspondiente) || Number(corte.slice(0, 4));
    const desde = m > 0 ? finMes(a, m) : corte;
    return { id: c.id, nombre: c.descripcion, mes: `${c.mes_correspondiente || ""} ${a}`, tipo: c.tipo, monto: Number(c.monto) || 0, t: tramo(diasEntre(desde, corte)) };
  }).sort((a, b) => b.t - a.t || b.monto - a.monto);
  const sumTr = (xs, f) => TRAMOS.map((_, i) => xs.reduce((s, x) => s + f(x, i), 0));
  return {
    cxc, cxp, tramosCxc: sumTr(cxc, (x, i) => x.tr[i]), tramosCxp: sumTr(cxp, (x, i) => (x.t === i ? x.monto : 0)),
    totCxc: cxc.reduce((s, x) => s + x.total, 0), totCxp: cxp.reduce((s, x) => s + x.monto, 0),
  };
}

export function Antiguedad({ data, sel, vista }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const corte = finMes(sel.anio, sel.mes) < hoy ? finMes(sel.anio, sel.mes) : hoy;
  const r = useMemo(() => calcularAntiguedad(data, corte), [data, corte]);
  const [abierto, setAbierto] = useState({});
  const colTr = [VERDE, AZUL, NARANJA, ROJO];
  return (<div style={card}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Antigüedad de saldos al {fechaC(corte)}</h3>
    <p style={{ fontSize: 11.5, color: GRIS, margin: "0 0 14px" }}>Cuánto tiempo lleva pendiente cada deuda. Lo que pasa de 90 días es lo más difícil de cobrar y lo primero que hay que revisar. Incluye todos los meses (también antes de noviembre).</p>
    {vista === "sencilla" ? <>
      <Titular sub={`${r.cxc.length} alumnos con mensualidades sin pagar · ${r.cxp.length} cuentas por pagar de la escuela.`}>Los padres deben <span style={{ color: NARANJA }}>{Lc(r.totCxc)}</span> y la escuela debe <span style={{ color: ROJO }}>{Lc(r.totCxp)}</span>.</Titular>
      <Kpis items={TRAMOS.map(([t], i) => ({ t: `Padres: ${t}`, v: Lc(r.tramosCxc[i]), color: colTr[i], borde: colTr[i], s: `${r.cxc.filter((x) => x.tr[i] > 0).length} alumnos` }))} />
      <div className="vn-dos">
        <Desglose titulo="¿Quién debe más?" color={NARANJA} abierto={abierto} toggle={(k) => setAbierto((p) => ({ ...p, [k]: !p[k] }))} vacio="Nadie debe. 🎉"
          items={r.cxc.slice(0, 40).map((x) => ({ t: x.nombre, v: x.total, d: `${x.meses.length} ${x.meses.length === 1 ? "mes" : "meses"}${x.tr[3] > 0 ? " · más de 90 días" : ""}`, colorV: x.tr[3] > 0 ? ROJO : undefined, sub: x.meses }))} />
        <Desglose titulo="¿Qué debe la escuela?" color={ROJO} vacio="La escuela no debe nada. 🎉"
          items={r.cxp.map((x) => ({ t: x.nombre, v: x.monto, d: `${x.mes} · ${TRAMOS[x.t][0]}` }))} />
      </div>
    </> : <>
      <Hoja minWidth={760} sangria={false} columnas={[{ t: "Alumno" }, { t: "Meses", ancho: 60 }, ...TRAMOS.map(([t]) => ({ t, num: true, ancho: 110 })), { t: "Total", num: true, ancho: 115 }]} filas={[
        { tipo: "sec", c: ["Cuentas por cobrar: mensualidades"] },
        ...(r.cxc.length === 0 ? [{ c: ["Nadie debe"] }] : r.cxc.map((x) => ({ c: [x.nombre, String(x.meses.length), ...x.tr.map((v) => v || ""), x.total], color: x.tr[3] > 0 ? ROJO : undefined }))),
        { tipo: "gran", c: ["Total que deben los padres", "", ...r.tramosCxc, r.totCxc] },
      ]} />
      <div style={{ height: 14 }} />
      <Hoja minWidth={760} sangria={false} columnas={[{ t: "Cuenta por pagar" }, { t: "Mes", ancho: 110 }, ...TRAMOS.map(([t]) => ({ t, num: true, ancho: 110 })), { t: "Total", num: true, ancho: 115 }]} filas={[
        { tipo: "sec", c: ["Cuentas por pagar de la escuela"] },
        ...(r.cxp.length === 0 ? [{ c: ["No debe nada"] }] : r.cxp.map((x) => ({ c: [x.nombre, x.mes, ...TRAMOS.map((_, i) => (x.t === i ? x.monto : "")), x.monto] }))),
        { tipo: "gran", c: ["Total que debe la escuela", "", ...r.tramosCxp, r.totCxp] },
      ]} pie="Los días de las mensualidades se cuentan desde que se envió el cobro; los de las cuentas por pagar, desde el fin del mes al que corresponden." />
    </>}
  </div>);
}
