// ════════════════════════════════════════════════════════════
//  FINANZAS → ALERTAS: informe en PDF (carta, horizontal)
//  Recibe los mismos datos que el Excel y arma un documento sobrio:
//  encabezado con logo, indicadores y una sección por pestaña.
//  Solo arma el documento; no lee ni escribe en la base de datos.
// ════════════════════════════════════════════════════════════

export const OPCIONES_PDF = {
  margin: [9, 9, 11, 9],
  image: { type: "jpeg", quality: 0.97 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollY: 0 },
  jsPDF: { unit: "mm", format: "letter", orientation: "landscape" },
  pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".kpis", ".cab", ".sec-cab"] },
};

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const L = (n) => `L&nbsp;${Math.round(Number(n) || 0).toLocaleString("es-HN")}`;
const Ls = (n) => (Number(n) < 0 ? "−" : "") + L(Math.abs(Number(n) || 0));
const rango = (txt) => { const m = String(txt || "").split(", ").filter(Boolean); return m.length <= 1 ? (m[0] || "—") : `${m[0]} – ${m[m.length - 1]}`; };

const CSS = `
.pa table thead th{background:#1B2A4A !important;color:#fff !important;font-size:9.5px !important;border:0 !important}
.pa table td,.pa table tr{border-color:#E4E8EE !important;color:inherit}
.pa table tbody tr:hover>td{background:inherit}
.pa h2{color:#1B2A4A !important}
.pa{width:100%;background:#fff;color:#1F2937;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:11px;line-height:1.4}
.pa *{box-sizing:border-box}
.cab{display:flex;align-items:center;gap:16px;padding-bottom:12px;border-bottom:2px solid #D9641E}
.cab img{width:62px;height:62px;object-fit:contain}
.cab .t{flex:1}
.cab .n{font-family:"IBM Plex Sans",Arial,sans-serif;font-size:19px;font-weight:700;color:#1B2A4A}
.cab .s{font-size:11px;color:#5B6576;margin-top:1px}
.cab .d{font-size:16px;font-weight:700;color:#1B2A4A;margin-top:6px}
.cab .p{text-align:right;font-size:10px;color:#5B6576;line-height:1.6}
.cab .p b{color:#1F2937}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 4px}
.k{border:1px solid #DCE1E8;border-left:3px solid var(--c);border-radius:4px;padding:9px 12px}
.k .kt{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#5B6576;font-weight:600}
.k .kv{font-family:"IBM Plex Mono",Consolas,monospace;font-size:19px;font-weight:700;color:var(--c);margin-top:3px}
.k .ks{font-size:9.5px;color:#5B6576}
.sec{margin-top:18px}
.salto{page-break-before:always;break-before:page;margin-top:0}
.sec-cab{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:7px}
.pa .sec-cab h2{font-family:"IBM Plex Sans",Arial,sans-serif;font-size:14px;margin:0;color:#1B2A4A}
.sec-cab .r{font-size:10px;color:#5B6576}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{background:#1B2A4A;color:#fff;font-weight:600;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;padding:6px 7px;text-align:left;white-space:nowrap}
td{padding:4px 7px;border-bottom:1px solid #E4E8EE;vertical-align:top}
tbody tr:nth-child(even) td{background:#F6F7F9}
tfoot td{font-weight:700;background:#E8ECF2;border-top:1px solid #1B2A4A;border-bottom:1px solid #1B2A4A}
.der{text-align:right;font-family:"IBM Plex Mono",Consolas,monospace}.cen{text-align:center}.nw{white-space:nowrap}.b{font-weight:700}
.g{color:#5B6576;font-size:9.5px}
.rojo{color:#8E3131}.ambar{color:#8F5E1A}.verde{color:#2A5E45}
.est{display:inline-block;padding:1px 7px;border-radius:9px;font-size:9px;font-weight:700;white-space:nowrap}
.est.rojo{background:#F6E8E8}.est.ambar{background:#F6EEE2}.est.verde{background:#E7F1EB}
.nota{font-size:9.5px;color:#5B6576;margin-top:6px;line-height:1.5}
.vacio{padding:12px;text-align:center;color:#2A5E45;border:1px solid #E4E8EE;border-radius:4px}
.pie{margin-top:16px;padding-top:6px;border-top:1px solid #DCE1E8;font-size:9px;color:#5B6576;display:flex;justify-content:space-between}
`;

const estado = (nivel, txt) => `<span class="est ${{ rojo: "rojo", amarillo: "ambar", verde: "verde" }[nivel]}">${txt}</span>`;

export function documentoAlertas(d, logoSrc) {
  const { nombre, sede, generado, kpis, parametros: p, deudores, grupos, otras } = d;
  const kpi = (c, t, v, s) => `<div class="k" style="--c:${c}"><div class="kt">${t}</div><div class="kv">${v}</div><div class="ks">${s}</div></div>`;
  const R = "#8E3131", A = "#8F5E1A", V = "#2A5E45";

  const tDeu = !deudores.length ? '<div class="vacio">✓ Nadie con mensualidades vencidas</div>' : `<table>
    <thead><tr><th>Estado</th><th>Alumno</th><th>Grupo</th><th class="cen">Meses</th><th>Periodo vencido</th><th class="der">Atraso</th><th class="der">Monto vencido</th><th>Encargado</th><th>Teléfono</th></tr></thead>
    <tbody>${deudores.map((x) => `<tr>
      <td>${estado(x.nivel, x.nivel === "rojo" ? "Urgente" : "Vencido")}</td>
      <td class="b">${esc(x.alumno)}${x.observacion ? `<div class="g rojo">${esc(x.observacion)}</div>` : ""}</td>
      <td>${esc(x.grupo || "—")}</td><td class="cen b">${x.meses}</td><td class="nw">${esc(rango(x.detalleMeses))}</td>
      <td class="der nw ${x.dias > 60 ? "rojo b" : ""}">${x.dias} días</td><td class="der nw b">${L(x.monto)}</td>
      <td>${esc(x.padre || "—")}</td><td class="nw">${esc(x.telefono || "—")}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="3">Total · ${deudores.length} alumnos</td><td class="cen">${deudores.reduce((s, x) => s + x.meses, 0)}</td><td></td><td></td><td class="der nw">${L(kpis.totalDeuda)}</td><td colspan="2"></td></tr></tfoot></table>
    <div class="nota"><b>Urgente:</b> 2 meses o más vencidos, o alumno retirado. <b>Vencido:</b> 1 mes. Solo cuenta mensualidades que ya pasaron su fecha límite, sin cobros repetidos.</div>`;

  const sum = (k) => grupos.reduce((s, g) => s + (Number(g[k]) || 0), 0);
  const etq = { rojo: "Pierde", amarillo: "En riesgo", verde: "Sostenible" };
  const tGru = `<table>
    <thead><tr><th>Estado</th><th>Grupo</th><th class="cen">Alumnos</th><th class="der">Cobra al mes</th><th class="der">Maestro</th><th class="der">Gastos fijos</th><th class="der">Resultado</th><th class="cen">Margen</th><th class="cen">Cobrado ${esc(p.mes.slice(0, 3))}</th><th class="cen">Equilibrio</th><th>Por qué</th></tr></thead>
    <tbody>${grupos.map((g) => `<tr>
      <td>${estado(g.nivel, etq[g.nivel])}</td>
      <td class="b">${esc(g.grupo)}<div class="g">${esc(g.maestros)}</div></td>
      <td class="cen">${g.alumnos}${g.becas ? `<div class="g">${g.becas} beca${g.becas > 1 ? "s" : ""}</div>` : ""}</td>
      <td class="der nw">${L(g.esperado)}</td><td class="der nw">${L(g.costoMaestro)}</td><td class="der nw">${L(g.fijo)}</td>
      <td class="der nw b ${g.resultado < 0 ? "rojo" : "verde"}">${Ls(g.resultado)}</td>
      <td class="cen">${g.esperado > 0 ? `${g.margen.toFixed(0)}%` : "—"}</td>
      <td class="cen ${g.pctCob != null && g.pctCob < 70 ? "rojo b" : ""}">${g.pctCob == null ? "—" : `${g.pctCob.toFixed(0)}%`}</td>
      <td class="cen">${g.equilibrio ?? "—"}</td>
      <td class="g ${{ rojo: "rojo", amarillo: "ambar", verde: "verde" }[g.nivel]}" style="font-size:9.5px">${esc(g.motivos || "Sostenible")}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="2">Total · ${grupos.length} grupos</td><td class="cen">${sum("alumnos")}</td><td class="der nw">${L(sum("esperado"))}</td><td class="der nw">${L(sum("costoMaestro"))}</td><td class="der nw">${L(sum("fijo"))}</td><td class="der nw ${sum("resultado") < 0 ? "rojo" : "verde"}">${Ls(sum("resultado"))}</td><td class="cen">${sum("esperado") > 0 ? `${((sum("resultado") / sum("esperado")) * 100).toFixed(0)}%` : "—"}</td><td class="cen">${sum("facturado") > 0 ? `${((sum("cobrado") / sum("facturado")) * 100).toFixed(0)}%` : "—"}</td><td colspan="2"></td></tr></tfoot></table>
    <div class="nota"><b>Resultado</b> = lo que cobra al mes (sin becados) − salario del maestro repartido entre sus grupos − su parte de gastos fijos (L ${Math.round(p.fijos).toLocaleString("es-HN")} al mes repartidos por alumno). <b>Equilibrio</b> = alumnos pagando que necesita para no perder. «En riesgo» = margen menor a ${p.margen}% o cobranza baja.</div>`;

  const tOtr = !otras.length ? '<div class="vacio">✓ Sin alertas</div>' : `<table>
    <thead><tr><th>Tipo</th><th>Alumno o concepto</th><th>Mes</th><th>Documento</th><th class="der">Monto</th><th>Qué hacer</th></tr></thead>
    <tbody>${otras.map((o) => `<tr><td class="b ${o.grave ? "rojo" : "ambar"}">${esc(o.tipo)}</td><td>${esc(o.quien)}</td><td class="nw">${esc(o.mes || "—")}</td><td class="nw">${esc(o.doc || "—")}</td><td class="der nw b">${L(o.monto)}</td><td class="g">${esc(o.accion)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="4">Total · ${otras.length} alertas</td><td class="der nw">${L(otras.reduce((s, o) => s + (Number(o.monto) || 0), 0))}</td><td></td></tr></tfoot></table>`;

  const cab = `<div class="cab">${logoSrc ? `<img src="${esc(logoSrc)}" alt="">` : ""}<div class="t"><div class="n">${esc(nombre)}</div><div class="s">Finanzas${sede ? " · " + esc(sede) : ""}</div><div class="d">Informe de alertas financieras</div></div>
    <div class="p">Generado el <b>${esc(generado)}</b><br>Cobranza medida en <b>${esc(p.mes)} ${p.anio}</b><br>Gastos fijos: <b>${L(p.fijos)}</b> al mes · Margen sano: <b>${p.margen}%</b></div></div>`;

  return `<div class="pa"><style>${CSS}</style>${cab}
    <div class="kpis">
      ${kpi(kpis.deudores ? R : V, "Padres con deuda vencida", kpis.deudores, `${kpis.urgentes} urgentes`)}
      ${kpi(kpis.totalDeuda ? A : V, "Total vencido por cobrar", L(kpis.totalDeuda), "Sin cobros repetidos")}
      ${kpi(kpis.gruposRojo ? R : V, "Grupos que pierden dinero", `${kpis.gruposRojo} de ${grupos.length}`, `${kpis.gruposAmarillo} más en riesgo · resultado total ${Ls(kpis.resultadoTotal)}`)}
      ${kpi(otras.length ? A : V, "Otras alertas", otras.length, `Cuentas atrasadas ${L(kpis.cxpMonto)} · ${kpis.repetidos} repetidos`)}
    </div>
    <div class="sec"><div class="sec-cab"><h2>1. Sostenibilidad por grupo</h2><div class="r">De peor a mejor resultado</div></div>${tGru}</div>
    <div class="sec salto"><div class="sec-cab"><h2>2. Padres con mensualidades vencidas</h2><div class="r">${deudores.length} alumnos · ${L(kpis.totalDeuda)} · de mayor a menor deuda</div></div>${tDeu}</div>
    <div class="sec salto"><div class="sec-cab"><h2>3. Otras alertas</h2><div class="r">Pagos atrasados de la escuela y registros repetidos</div></div>${tOtr}</div>
    <div class="pie"><span>${esc(nombre)} · Informe de solo lectura; no modifica datos.</span><span>Cifras en Lempiras</span></div>
  </div>`;
}
