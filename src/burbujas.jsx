// Fondo decorativo: burbujas de vidrio que suben despacio y Pulpi, el pulpo
// naranja de la escuela, nadando tenue detrás de todo.
const TONOS = ["rgba(249,115,22,.22)", "rgba(56,189,248,.2)", "rgba(168,85,247,.18)", "rgba(236,72,153,.16)", "rgba(30,41,59,.14)"];
const LISTA = Array.from({ length: 14 }, (_, i) => {
  const azar = (n) => { const x = Math.sin(i * 97.13 + n * 13.7) * 10000; return x - Math.floor(x); };
  return { tam: 26 + Math.round(azar(1) * 90), izq: Math.round(azar(2) * 96), t: 24 + Math.round(azar(3) * 26), d: -Math.round(azar(4) * 40), dx: Math.round((azar(5) - 0.5) * 140), tono: TONOS[i % TONOS.length] };
});

// Pulpi como en el dibujo de la escuela: naranja plano con contorno café
// oscuro, ojos grandes mirando de lado y tentáculos largos y ondulados.
// Cada tentáculo sale del cuerpo (x, y) y se dibuja desde ahí.
const TENTACULOS = [
  { x: 100, y: 108, d: "M0 0 C -14 2, -30 -6, -40 -18 C -48 -28, -58 -30, -64 -24" },   // brazo arriba izquierda
  { x: 140, y: 108, d: "M0 0 C 14 2, 30 -8, 40 -20 C 48 -30, 58 -32, 64 -26" },        // brazo arriba derecha
  { x: 98, y: 118, d: "M0 0 C -16 12, -34 22, -52 22 C -64 22, -72 28, -74 36" },       // brazo abajo izquierda
  { x: 142, y: 118, d: "M0 0 C 16 12, 34 24, 52 24 C 64 24, 72 30, 74 38" },           // brazo abajo derecha
  { x: 108, y: 124, d: "M0 0 C -6 18, -18 32, -22 48 C -25 60, -18 68, -26 76" },
  { x: 117, y: 127, d: "M0 0 C -2 20, -8 38, -6 56 C -4 68, -12 76, -10 86" },
  { x: 126, y: 127, d: "M0 0 C 4 20, 10 36, 8 54 C 6 66, 14 74, 12 84" },
  { x: 134, y: 124, d: "M0 0 C 8 16, 20 30, 24 46 C 27 58, 20 66, 28 74" },
];
const CAFE = "#3B2A20", NARANJA_PULPI = "#F4974E";

function Pulpi() {
  return (
    <div className="pulpi">
      <div className="pulpi-flota">
        <svg viewBox="8 6 224 214" width="100%" height="100%">
          {/* Tentáculos: contorno café y relleno naranja, cada uno a su ritmo */}
          {TENTACULOS.map((t, i) => (
            <g key={i} transform={`translate(${t.x} ${t.y})`}>
              <g className="pulpi-pata" style={{ animationDelay: `${-i * 0.4}s`, animationDuration: `${2.4 + (i % 3) * 0.4}s` }}>
                <path d={t.d} fill="none" stroke={CAFE} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
                <path d={t.d} fill="none" stroke={NARANJA_PULPI} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          ))}
          {/* Cabeza */}
          <path d="M120 22 C 156 22, 172 52, 170 82 C 168 108, 150 128, 120 128 C 90 128, 72 108, 70 82 C 68 52, 84 22, 120 22 Z" fill={NARANJA_PULPI} stroke={CAFE} strokeWidth="3.5" />
          {/* Ojos grandes mirando a un lado */}
          <ellipse cx="105" cy="84" rx="17" ry="21" fill="#fff" stroke={CAFE} strokeWidth="3" />
          <ellipse cx="137" cy="84" rx="17" ry="21" fill="#fff" stroke={CAFE} strokeWidth="3" />
          <ellipse cx="113" cy="88" rx="6.5" ry="7.5" fill={CAFE} />
          <ellipse cx="145" cy="88" rx="6.5" ry="7.5" fill={CAFE} />
        </svg>
        {/* Burbujitas que suelta Pulpi */}
        <span className="pulpi-burbuja" style={{ left: "56%", width: 12, height: 12, animationDelay: "0s" }} />
        <span className="pulpi-burbuja" style={{ left: "64%", width: 8, height: 8, animationDelay: "1.6s" }} />
        <span className="pulpi-burbuja" style={{ left: "50%", width: 10, height: 10, animationDelay: "3.1s" }} />
      </div>
    </div>
  );
}

export default function Burbujas() {
  return (
    <div className="burbujas" aria-hidden>
      {LISTA.map((b, i) => <span key={i} className="burbuja" style={{ width: b.tam, height: b.tam, left: `${b.izq}%`, "--t": `${b.t}s`, "--d": `${b.d}s`, "--dx": `${b.dx}px`, "--tono": b.tono }} />)}
      <Pulpi />
    </div>
  );
}
