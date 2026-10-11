// Fondo decorativo: burbujas de vidrio que suben despacio y Pulpi, el pulpo
// naranja de la escuela, nadando tenue detrás de todo.
const TONOS = ["rgba(249,115,22,.22)", "rgba(56,189,248,.2)", "rgba(168,85,247,.18)", "rgba(236,72,153,.16)", "rgba(30,41,59,.14)"];
const LISTA = Array.from({ length: 14 }, (_, i) => {
  const azar = (n) => { const x = Math.sin(i * 97.13 + n * 13.7) * 10000; return x - Math.floor(x); };
  return { tam: 26 + Math.round(azar(1) * 90), izq: Math.round(azar(2) * 96), t: 24 + Math.round(azar(3) * 26), d: -Math.round(azar(4) * 40), dx: Math.round((azar(5) - 0.5) * 140), tono: TONOS[i % TONOS.length] };
});

// Tentáculos: sale de abajo de la cabeza y termina en un rizo
const TENTACULOS = [
  { x: 46, d: "M0 0 C -26 10, -46 28, -42 50 C -39 64, -24 64, -27 53" },
  { x: 64, d: "M0 0 C -16 20, -30 44, -22 64 C -16 77, -3 72, -8 62" },
  { x: 84, d: "M0 0 C -5 26, -10 52, -2 70 C 4 81, 15 74, 8 65" },
  { x: 116, d: "M0 0 C 5 26, 10 52, 2 70 C -4 81, -15 74, -8 65" },
  { x: 136, d: "M0 0 C 16 20, 30 44, 22 64 C 16 77, 3 72, 8 62" },
  { x: 154, d: "M0 0 C 26 10, 46 28, 42 50 C 39 64, 24 64, 27 53" },
];

function Pulpi() {
  return (
    <div className="pulpi">
      <div className="pulpi-flota">
        <svg viewBox="-10 0 220 210" width="100%" height="100%">
          <defs>
            <radialGradient id="pulpiCabeza" cx="38%" cy="30%" r="75%">
              <stop offset="0" stopColor="#FFD3A8" />
              <stop offset=".45" stopColor="#FB923C" />
              <stop offset="1" stopColor="#EA580C" />
            </radialGradient>
            <linearGradient id="pulpiPata" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F97316" />
              <stop offset="1" stopColor="#FDBA74" />
            </linearGradient>
          </defs>
          {/* Tentáculos (se mueven cada uno a su ritmo) */}
          {TENTACULOS.map((t, i) => (
            <g key={i} transform={`translate(${t.x} 118)`}>
              <path className="pulpi-pata" style={{ animationDelay: `${-i * 0.45}s` }} d={t.d} fill="none" stroke="url(#pulpiPata)" strokeWidth="15" strokeLinecap="round" />
            </g>
          ))}
          {/* Cabeza */}
          <path d="M100 18 C 150 18, 170 58, 166 92 C 163 120, 140 132, 100 132 C 60 132, 37 120, 34 92 C 30 58, 50 18, 100 18 Z" fill="url(#pulpiCabeza)" />
          <ellipse cx="74" cy="46" rx="20" ry="11" fill="#fff" opacity=".55" transform="rotate(-25 74 46)" />
          {/* Ojos */}
          <ellipse cx="78" cy="84" rx="12" ry="14" fill="#fff" />
          <ellipse cx="122" cy="84" rx="12" ry="14" fill="#fff" />
          <circle cx="80" cy="87" r="7" fill="#1E293B" />
          <circle cx="124" cy="87" r="7" fill="#1E293B" />
          <circle cx="83" cy="83" r="2.6" fill="#fff" />
          <circle cx="127" cy="83" r="2.6" fill="#fff" />
          {/* Cachetes y sonrisa */}
          <ellipse cx="62" cy="104" rx="9" ry="5" fill="#F472B6" opacity=".45" />
          <ellipse cx="138" cy="104" rx="9" ry="5" fill="#F472B6" opacity=".45" />
          <path d="M88 106 Q 100 117 112 106" fill="none" stroke="#7C2D12" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {/* Burbujitas que suelta Pulpi */}
        <span className="pulpi-burbuja" style={{ left: "58%", width: 12, height: 12, animationDelay: "0s" }} />
        <span className="pulpi-burbuja" style={{ left: "66%", width: 8, height: 8, animationDelay: "1.6s" }} />
        <span className="pulpi-burbuja" style={{ left: "52%", width: 10, height: 10, animationDelay: "3.1s" }} />
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
