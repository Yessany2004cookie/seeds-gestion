// ════════════════════════════════════════════════════════════
//  DOS VISTAS PARA LAS PANTALLAS DE NÚMEROS
//  · Vista sencilla: tarjetas con los totales grandes, barras y frases cortas,
//    para quien no sabe contabilidad.
//  · Vista Excel: cuadrícula tipo hoja de cálculo (letras de columna, número
//    de fila, celdas con borde), para revisar cifra por cifra.
//  Solo presentación: estos componentes no leen ni guardan datos.
// ════════════════════════════════════════════════════════════
import { useState } from "react";

const CLAVE = "seeds_vista_numeros";
export const VERDE = "#2F6B4F", ROJO = "#A33A3A", NARANJA = "#D9641E", AZUL = "#1B2A4A", GRIS = "#5B6576";
export const L = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; const t = `L ${Math.abs(v).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return v < 0 ? `(${t})` : t; };
// Lempiras sin centavos cuando son cerrados, para las tarjetas grandes
export const Lc = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; const t = `L ${Math.abs(v).toLocaleString("es-HN", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`; return v < 0 ? `− ${t}` : t; };

// Vista elegida (se recuerda en este navegador y es la misma en todas las pantallas)
export function useVista() {
  const [vista, set] = useState(() => { try { return localStorage.getItem(CLAVE) || "sencilla"; } catch (e) { return "sencilla"; } });
  const setVista = (v) => { set(v); try { localStorage.setItem(CLAVE, v); } catch (e) { /* sin almacenamiento */ } };
  return [vista, setVista];
}

const CSS = `
.vn-sel{display:inline-flex;border:1px solid #CDD3DC;border-radius:4px;overflow:hidden}
.vn-sel button{padding:7px 14px;border:none;background:#FFFFFF;color:#344054;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.vn-sel button+button{border-left:1px solid #CDD3DC}
.vn-sel button[aria-selected="true"]{background:#1B2A4A;color:#fff}
.vn-tit,.vn-kpis,.vn-caja,.vn-dos{font-family:var(--letra-informe)}
.vn-tit{border-left:4px solid #D9641E;padding:2px 0 2px 14px;margin:0 0 16px}
.vn-tit h4{font-family:var(--letra-informe);font-size:19px;font-weight:600;color:#1B2A4A;margin:0;line-height:1.35}
.vn-tit p{font-size:13px;color:#5B6576;margin:4px 0 0;line-height:1.5}
.vn-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 14px}
.vn-kpi{border:1px solid #DCE1E8;border-radius:6px;padding:12px 14px;background:#FFFFFF}
.vn-kpi.dest{background:#F5F7FA}
.vn-kpi .t{font-size:12px;color:#5B6576}
.vn-kpi .v{font-family:var(--letra-cifra);letter-spacing:-.4px;font-size:24px;font-weight:600;margin:2px 0;font-variant-numeric:tabular-nums;white-space:nowrap}
.vn-kpi .s{font-size:11.5px;color:#5B6576;line-height:1.4}
.vn-caja{border:1px solid #DCE1E8;border-radius:6px;padding:14px 16px;background:#FFFFFF;margin:0 0 14px}
.vn-caja h5{font-family:var(--letra-informe);font-size:15px;font-weight:600;color:#1B2A4A;margin:0 0 10px}
.vn-dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin:0 0 14px}
.vn-dos .vn-caja{margin:0}
.vn-comp{display:grid;grid-template-columns:auto 1fr auto;gap:8px 14px;align-items:center;font-size:13px}
.vn-barra{height:10px;background:#F1F3F6;border-radius:2px;overflow:hidden}
.vn-barra i{display:block;height:100%;border-radius:2px}
.vn-it{padding:9px 0;border-top:1px solid #EEF1F5}
.vn-it:first-of-type{border-top:none;padding-top:0}
.vn-it .f{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.vn-it .n{font-weight:600;font-size:13.5px;color:#1F2937}
.vn-it .m{font-family:var(--letra-cifra);font-weight:700;font-size:13.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.vn-it .d{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:#5B6576;margin:1px 0 5px}
.vn-it.click{cursor:pointer}
.vn-sub{margin:6px 0 2px 10px;padding-left:10px;border-left:2px solid #DCE1E8}
.vn-sub div{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#5B6576;padding:2px 0}
.vn-mov{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid #EEF1F5}
.vn-mov:first-child{border-top:none}
.vn-mov .fe{font-size:11px;color:#5B6576;min-width:44px;text-align:center;border:1px solid #DCE1E8;border-radius:4px;padding:3px 4px;line-height:1.2}
.vn-mov .fe b{display:block;font-size:16px;color:#1B2A4A;font-family:var(--letra-cifra)}
.vn-mov .tx{flex:1;min-width:0;font-size:13px;color:#1F2937;line-height:1.45}
.vn-mov .tx small{display:block;color:#5B6576;font-size:11.5px}
.vn-mov .mo{font-family:var(--letra-cifra);font-weight:700;font-size:13.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.vn-vacio{font-size:13px;color:#5B6576;padding:6px 0}
/* Vista Excel */
.vx-w{overflow-x:auto;border:1px solid #C9D1DC;border-radius:2px;background:#FFFFFF}
.vx{font-family:var(--letra-informe);border-collapse:collapse;width:100%;font-size:12.5px;font-variant-numeric:tabular-nums}
.vx td,.vx th{border:1px solid #DCE1E8;padding:5px 8px;vertical-align:top}
.vx .le th{background:#EEF1F5;color:#7A8597;font-weight:500;font-size:10.5px;text-align:center;padding:3px 4px;font-family:Calibri,Arial,sans-serif}
.vx .rn{background:#EEF1F5;color:#7A8597;font-size:10.5px;text-align:center;width:34px;min-width:34px;padding:5px 2px;font-family:Calibri,Arial,sans-serif}
.vx .cab td{background:#1B2A4A;color:#FFFFFF;font-weight:700;font-size:11.5px;letter-spacing:.3px;text-transform:uppercase}
.vx .cab td.rn{background:#EEF1F5;color:#7A8597;text-transform:none;font-weight:500}
.vx .sec td{background:#F3F5F8;font-weight:700;color:#1B2A4A}
.vx .sec td.rn{background:#EEF1F5;font-weight:500;color:#7A8597}
.vx .it td.c1{padding-left:18px}
.vx .det td{color:#5B6576;font-size:11.5px}
.vx .det td.c1{padding-left:32px}
.vx .tot td{font-weight:700;border-top:1.5px solid #8A95A6}
.vx .gran td{font-weight:800;font-size:13.5px;border-top:2px solid #1B2A4A;background:#FAFBFC}
.vx .gran td.rn,.vx .tot td.rn{font-weight:500;font-size:10.5px;background:#EEF1F5}
.vx .num{text-align:right;white-space:nowrap;font-family:var(--letra-cifra)}
.vx tr.click{cursor:pointer}
.vx tr.click:hover td:not(.rn){background:#FFF8F2}
.vx-pie{font-size:11px;color:#5B6576;margin-top:6px}
/* Modo oscuro */
html[data-fondo="oscuro"] .vn-sel{border-color:#2E2F2F}
html[data-fondo="oscuro"] .vn-sel button{background:#242626;color:#D1D7DB}
html[data-fondo="oscuro"] .vn-sel button+button{border-color:#2E2F2F}
html[data-fondo="oscuro"] .vn-sel button[aria-selected="true"]{background:#D9641E;color:#fff}
html[data-fondo="oscuro"] .vn-tit h4,html[data-fondo="oscuro"] .vn-caja h5,html[data-fondo="oscuro"] .vn-mov .fe b{color:#E9EDEF}
html[data-fondo="oscuro"] .vn-tit p,html[data-fondo="oscuro"] .vn-kpi .t,html[data-fondo="oscuro"] .vn-kpi .s,html[data-fondo="oscuro"] .vn-it .d,html[data-fondo="oscuro"] .vn-sub div,html[data-fondo="oscuro"] .vn-mov .fe,html[data-fondo="oscuro"] .vn-mov .tx small,html[data-fondo="oscuro"] .vn-vacio,html[data-fondo="oscuro"] .vx-pie{color:#AEBAC1}
html[data-fondo="oscuro"] .vn-it .n,html[data-fondo="oscuro"] .vn-mov .tx{color:#E9EDEF}
html[data-fondo="oscuro"] .vn-kpi,html[data-fondo="oscuro"] .vn-caja{background:#1D1F1F;border-color:#2E2F2F}
html[data-fondo="oscuro"] .vn-kpi.dest{background:#242626}
html[data-fondo="oscuro"] .vn-barra{background:#2E2F2F}
html[data-fondo="oscuro"] .vn-it,html[data-fondo="oscuro"] .vn-mov{border-color:#2E2F2F}
html[data-fondo="oscuro"] .vn-sub,html[data-fondo="oscuro"] .vn-mov .fe{border-color:#2E2F2F}
html[data-fondo="oscuro"] .vx-w{background:#1D1F1F;border-color:#2E2F2F}
html[data-fondo="oscuro"] .vx td,html[data-fondo="oscuro"] .vx th{border-color:#2E2F2F;color:#E9EDEF}
html[data-fondo="oscuro"] .vx .le th,html[data-fondo="oscuro"] .vx .rn,html[data-fondo="oscuro"] .vx .sec td,html[data-fondo="oscuro"] .vx .cab td.rn,html[data-fondo="oscuro"] .vx .gran td.rn,html[data-fondo="oscuro"] .vx .tot td.rn{background:#242626 !important;color:#8696A0}
html[data-fondo="oscuro"] .vx .sec td:not(.rn){color:#E9EDEF}
html[data-fondo="oscuro"] .vx .cab td:not(.rn){background:#D9641E}
html[data-fondo="oscuro"] .vx .det td{color:#AEBAC1}
html[data-fondo="oscuro"] .vx .gran td:not(.rn){background:#1D1F1F;border-top-color:#D9641E}
html[data-fondo="oscuro"] .vx tr.click:hover td:not(.rn){background:#2A2420}
`;
export const EstilosVistas = () => <style>{CSS}</style>;

// Botones "Vista sencilla | Vista Excel"
export function SelectorVista({ vista, setVista }) {
  return (<div className="vn-sel" role="tablist">
    {[["sencilla", "Vista sencilla"], ["excel", "Vista Excel"]].map(([k, t]) => <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)}>{t}</button>)}
  </div>);
}

// ── Piezas de la vista sencilla ──
export const Titular = ({ children, sub }) => <div className="vn-tit"><h4>{children}</h4>{sub && <p>{sub}</p>}</div>;

export const Kpis = ({ items }) => <div className="vn-kpis">{items.filter(Boolean).map((k) =>
  <div key={k.t} className={"vn-kpi" + (k.dest ? " dest" : "")} style={k.borde ? { borderTop: `3px solid ${k.borde}` } : undefined}>
    <div className="t">{k.t}</div><div className="v" style={{ color: k.color || AZUL }}>{k.v}</div>{k.s && <div className="s">{k.s}</div>}
  </div>)}</div>;

export const Barra = ({ pct, color }) => <div className="vn-barra"><i style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, background: color }} /></div>;

// Comparación de dos o más montos en barras horizontales
export const Comparar = ({ filas }) => { const max = Math.max(1, ...filas.map((f) => Math.abs(f.v))); return (<div className="vn-caja"><div className="vn-comp">
  {filas.map((f) => [<span key={f.t + "t"}>{f.t}</span>, <Barra key={f.t + "b"} pct={Math.abs(f.v) / max * 100} color={f.color} />, <b key={f.t + "v"} style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Lc(f.v)}</b>])}
</div></div>); };

// Lista con barra de porcentaje: "¿De dónde vino el dinero?"
export function Desglose({ titulo, items, color, vacio = "Nada este mes.", abierto, toggle }) {
  const total = items.reduce((s, x) => s + Math.abs(x.v), 0) || 1;
  return (<div className="vn-caja"><h5>{titulo}</h5>
    {items.length === 0 ? <div className="vn-vacio">{vacio}</div> : items.map((x) => { const pct = Math.round(Math.abs(x.v) / total * 100); const ab = abierto && abierto[x.t]; return (
      <div key={x.t} className={"vn-it" + (x.sub && toggle ? " click" : "")} onClick={x.sub && toggle ? () => toggle(x.t) : undefined}>
        <div className="f"><span className="n">{x.sub && toggle ? (ab ? "▾ " : "▸ ") : ""}{x.t}</span><span className="m" style={{ color: x.colorV }}>{Lc(Math.abs(x.v))}</span></div>
        <div className="d"><span>{x.d || ""}</span><span>{pct}%</span></div>
        <Barra pct={pct} color={color} />
        {ab && <div className="vn-sub">{x.sub.map((s, i) => <div key={i}><span>{s.t}</span><span style={{ whiteSpace: "nowrap" }}>{L(s.v)}</span></div>)}</div>}
      </div>); })}
  </div>);
}

// Lista de movimientos con fecha en recuadro (libros diario y mayor)
export const Movimientos = ({ items, vacio = "Sin movimientos." }) => <div>{items.length === 0 ? <div className="vn-vacio">{vacio}</div> : items.map((m, i) => { const [a, me, d] = String(m.fecha || "").split("-"); return (
  <div key={m.k || i} className="vn-mov">
    <div className="fe"><b>{d || "–"}</b>{["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][Number(me) - 1] || a || ""}</div>
    <div className="tx">{m.t}{m.s && <small>{m.s}</small>}</div>
    {m.v !== undefined && <div className="mo" style={{ color: m.color }}>{m.signo ? (m.v >= 0 ? "+ " : "− ") : ""}{Lc(Math.abs(m.v))}</div>}
  </div>); })}</div>;

// ── Vista Excel ──
// columnas: [{ t: "Concepto", num: true?, ancho: 120? }]
// filas: [{ tipo: "sec"|"it"|"det"|"tot"|"gran"|"vacia", c: [celdas], color?, onClick? }]
// Las celdas de columnas num se escriben en Lempiras; un texto se deja tal cual.
const LETRAS = "ABCDEFGHIJ";
export function Hoja({ columnas, filas, pie, minWidth = 460, sangria = true }) {
  let n = 1;
  const celda = (col, v) => (col.num && typeof v === "number" ? L(v) : col.pct && typeof v === "number" ? `${v.toFixed(1)}%` : v ?? "");
  return (<>
    <div className="vx-w"><table className="vx" style={{ minWidth }}>
      <colgroup><col style={{ width: 34 }} />{columnas.map((c, i) => <col key={i} style={c.ancho ? { width: c.ancho } : undefined} />)}</colgroup>
      <thead><tr className="le"><th />{columnas.map((c, i) => <th key={i}>{LETRAS[i]}</th>)}</tr></thead>
      <tbody>
        <tr className="cab"><td className="rn">{n++}</td>{columnas.map((c, i) => <td key={i} className={c.num || c.pct ? "num" : ""}>{c.t}</td>)}</tr>
        {filas.map((f, j) => <tr key={j} className={(f.tipo || "it") + (f.onClick ? " click" : "")} onClick={f.onClick}>
          <td className="rn">{n++}</td>
          {columnas.map((c, i) => <td key={i} className={(i === 0 && sangria ? "c1 " : "") + (c.num || c.pct ? "num" : "")} style={f.color && (c.num || f.tipo === "gran") ? { color: f.color } : undefined}>{f.tipo === "vacia" ? "" : celda(c, (f.c || [])[i])}</td>)}
        </tr>)}
      </tbody>
    </table></div>
    {pie && <div className="vx-pie">{pie}</div>}
  </>);
}
