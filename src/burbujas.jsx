// Burbujas de vidrio que suben despacio detrás de todo (decoración).
const TONOS = ["rgba(249,115,22,.22)", "rgba(56,189,248,.2)", "rgba(168,85,247,.18)", "rgba(236,72,153,.16)", "rgba(30,41,59,.14)"];
const LISTA = Array.from({ length: 14 }, (_, i) => {
  const azar = (n) => { const x = Math.sin(i * 97.13 + n * 13.7) * 10000; return x - Math.floor(x); };
  return { tam: 26 + Math.round(azar(1) * 90), izq: Math.round(azar(2) * 96), t: 24 + Math.round(azar(3) * 26), d: -Math.round(azar(4) * 40), dx: Math.round((azar(5) - 0.5) * 140), tono: TONOS[i % TONOS.length] };
});
export default function Burbujas() {
  return (
    <div className="burbujas" aria-hidden>
      {LISTA.map((b, i) => <span key={i} style={{ width: b.tam, height: b.tam, left: `${b.izq}%`, "--t": `${b.t}s`, "--d": `${b.d}s`, "--dx": `${b.dx}px`, "--tono": b.tono }} />)}
    </div>
  );
}
