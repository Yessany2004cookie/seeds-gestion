// ════════════════════════════════════════════════════════════
//  INICIO con estilo Soft UI: tarjetas en relieve suave sobre un fondo gris
//  uniforme. Cifras grandes con mini gráfica de 6 meses y variación contra el
//  mes anterior, barras de ingresos y gastos, dona del estado de cobros,
//  secciones con más alumnos y los últimos pagos recibidos.
//  Solo lee los datos: no cambia nada del flujo de cobro.
// ════════════════════════════════════════════════════════════
import { useState } from "react";
import "./inicioSoft.css";

const L = (v) => `L ${Math.round(v).toLocaleString("es-HN")}`;
const corto = (v) => {
  const a = Math.abs(v);
  if (a >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (a >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

// Mini gráfica de línea (últimos meses)
function Sparkline({ serie }) {
  const w = 96, h = 34, p = 3;
  const max = Math.max(...serie, 1), min = Math.min(...serie, 0);
  const rango = max - min || 1;
  const pts = serie.map((v, i) => [p + (i * (w - 2 * p)) / Math.max(serie.length - 1, 1), h - p - ((v - min) / rango) * (h - 2 * p)]);
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const area = d + ` L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`;
  const u = pts[pts.length - 1];
  return (
    <svg className="sp-linea" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={area} className="sp-area" />
      <path d={d} className="sp-trazo" />
      <circle cx={u[0]} cy={u[1]} r="2.6" className="sp-punto" />
    </svg>
  );
}

// Variación contra el mes anterior. "subirEsBueno" decide el color.
function Variacion({ actual, anterior, subirEsBueno = true }) {
  if (!anterior) return <span className="sp-var sp-var-nada">—</span>;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (!isFinite(pct)) return <span className="sp-var sp-var-nada">—</span>;
  const sube = pct >= 0;
  const bueno = sube === subirEsBueno || Math.abs(pct) < 0.05;
  return <span className={"sp-var " + (bueno ? "sp-var-bien" : "sp-var-mal")} title="Comparado con el mes anterior">{sube ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%</span>;
}

function Kpi({ k, irA }) {
  const n = k.serie.length;
  return (
    <button type="button" className="sp-tarjeta sp-kpi" onClick={() => irA(k.p)}>
      <span className="sp-kpi-arriba">
        <span className="sp-kpi-titulo">{k.l}</span>
        <Variacion actual={k.serie[n - 1]} anterior={k.serie[n - 2]} subirEsBueno={k.subirEsBueno !== false} />
      </span>
      <span className="sp-kpi-abajo">
        <span className="cifra sp-kpi-valor">{k.v}</span>
        <Sparkline serie={k.serie} />
      </span>
    </button>
  );
}

// Barras agrupadas: ingresos y gastos por mes
function Barras({ meses }) {
  const [sel, setSel] = useState(null);
  const H = 230, max = Math.max(...meses.flatMap((m) => [m.ing, m.gas]), 1);
  const paso = Math.pow(10, Math.floor(Math.log10(max)));
  const tope = Math.ceil(max / paso) * paso;
  const lineas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * tope);
  return (
    <div className="sp-barras" onMouseLeave={() => setSel(null)}>
      <div className="sp-eje">
        {lineas.slice().reverse().map((v) => <span key={v}>L {corto(v)}</span>)}
      </div>
      <div className="sp-lienzo" style={{ height: H }}>
        {lineas.map((v) => <div key={v} className="sp-guia" style={{ bottom: (v / tope) * H }} />)}
        <div className="sp-columnas">
          {meses.map((m, i) => (
            <div key={m.etiqueta} className={"sp-col" + (sel === i ? " activa" : "")} onMouseEnter={() => setSel(i)} onClick={() => setSel(i)}>
              <div className="sp-par">
                <span className="sp-barra sp-ing" style={{ height: Math.max((m.ing / tope) * H, m.ing ? 3 : 0) }} />
                <span className="sp-barra sp-gas" style={{ height: Math.max((m.gas / tope) * H, m.gas ? 3 : 0) }} />
              </div>
              <span className="sp-mes">{m.etiqueta}</span>
              {sel === i && <div className="sp-globo"><b>{m.nombre}</b><span><i className="sp-dot sp-ing" />Ingresos {L(m.ing)}</span><span><i className="sp-dot sp-gas" />Gastos {L(m.gas)}</span></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dona del estado de los cobros del mes
function Dona({ partes, total }) {
  const r = 52, c = 2 * Math.PI * r;
  let acum = 0;
  const pagados = partes[0].n;
  return (
    <div className="sp-dona">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`${pagados} de ${total} cobros pagados`}>
        <circle cx="70" cy="70" r={r} className="sp-dona-fondo" />
        {total > 0 && partes.map((pt) => {
          const largo = (pt.n / total) * c;
          const el = pt.n > 0 && <circle key={pt.k} cx="70" cy="70" r={r} className={"sp-arco sp-" + pt.k} strokeDasharray={`${Math.max(largo - 2, 0.01)} ${c}`} strokeDashoffset={-acum} transform="rotate(-90 70 70)" />;
          acum += largo;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="sp-dona-num">{total ? Math.round((pagados / total) * 100) : 0}%</text>
        <text x="70" y="86" textAnchor="middle" className="sp-dona-sub">pagado</text>
      </svg>
      <ul className="sp-leyenda">
        {partes.map((pt) => (
          <li key={pt.k}><i className={"sp-dot sp-" + pt.k} /><span>{pt.l}</span><b>{pt.n}</b><small>{total ? Math.round((pt.n / total) * 100) : 0}%</small></li>
        ))}
      </ul>
    </div>
  );
}

export function InicioSoft({ kpis, meses, cobros, secciones, recientes, mes, irA }) {
  const totalCobros = cobros.reduce((s, p) => s + p.n, 0);
  const maxSec = Math.max(...secciones.map((s) => s.n), 1);
  return (
    <div className="soft">
      <div className="sp-encabezado">
        <div>
          <div className="sp-eyebrow">Panorama de la escuela</div>
          <h2 className="sp-titulo">{mes}</h2>
        </div>
      </div>

      <div className="sp-kpis">{kpis.map((k) => <Kpi key={k.l} k={k} irA={irA} />)}</div>

      <div className="sp-fila sp-fila-graficas">
        <section className="sp-tarjeta sp-panel">
          <div className="sp-panel-cabeza">
            <h3>Ingresos y gastos</h3>
            <div className="sp-claves"><span><i className="sp-dot sp-ing" />Ingresos</span><span><i className="sp-dot sp-gas" />Gastos</span></div>
          </div>
          <Barras meses={meses} />
        </section>
        <section className="sp-tarjeta sp-panel">
          <div className="sp-panel-cabeza">
            <h3>Estado de cobros</h3>
            <button type="button" className="sp-ver" onClick={() => irA("facturas")}>Ver</button>
          </div>
          <div className="sp-sub">Mensualidades de {mes.split(" ")[0].toLowerCase()} · {totalCobros} cobros</div>
          <Dona partes={cobros} total={totalCobros} />
        </section>
      </div>

      <div className="sp-fila sp-fila-listas">
        <section className="sp-tarjeta sp-panel">
          <div className="sp-panel-cabeza">
            <h3>Secciones con más alumnos</h3>
            <button type="button" className="sp-ver" onClick={() => irA("secciones")}>Ver</button>
          </div>
          {secciones.length === 0 && <div className="sp-vacio">Aún no hay secciones con alumnos.</div>}
          <ul className="sp-ranking">
            {secciones.map((s) => (
              <li key={s.nombre} className="sp-hundido">
                <div className="sp-ranking-fila"><span>{s.nombre}</span><b>{s.n} {s.n === 1 ? "alumno" : "alumnos"}</b></div>
                <div className="sp-pista"><span style={{ width: `${(s.n / maxSec) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="sp-tarjeta sp-panel">
          <div className="sp-panel-cabeza">
            <h3>Pagos recientes</h3>
            <button type="button" className="sp-ver" onClick={() => irA("historial")}>Ver</button>
          </div>
          {recientes.length === 0 && <div className="sp-vacio">Todavía no hay pagos registrados.</div>}
          {recientes.length > 0 && (
            <table className="sp-tabla" data-tarjetas="no">
              <thead><tr><th>Comprobante</th><th>Alumno</th><th className="sp-ocultar">Mes</th><th className="sp-ocultar">Fecha</th><th className="sp-der">Monto</th></tr></thead>
              <tbody>
                {recientes.map((r) => (
                  <tr key={r.id}>
                    <td className="sp-num">{r.numero}</td>
                    <td>{r.alumno}</td>
                    <td className="sp-ocultar"><span className="sp-chip">{r.mes}</span></td>
                    <td className="sp-ocultar">{r.fecha}</td>
                    <td className="sp-der cifra">{L(r.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
