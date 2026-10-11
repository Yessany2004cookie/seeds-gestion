import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Burbujas from './burbujas.jsx'
import './glass.css'


// Tablas en celular: cada fila se muestra como tarjeta. Aquí se le pone a
// cada celda el nombre de su columna (lo usa glass.css para la etiqueta).
// Las tablas con data-tarjetas="no" (como la matriz de asistencia) no cambian.
let pendiente = false
const etiquetarTablas = () => {
  pendiente = false
  document.querySelectorAll('#root table:not([data-tarjetas="no"])').forEach((t) => {
    const ths = [...t.querySelectorAll(':scope > thead > tr:last-child > th')]
    if (ths.length < 4) return
    t.classList.add('tabla-tarjetas')
    t.classList.toggle('tabla-num', ths[0].innerText.trim().length <= 3)
    const nombres = []; ths.forEach((th) => { for (let k = 0; k < (th.colSpan || 1); k++) nombres.push(th.innerText.trim()) })
    t.querySelectorAll(':scope > tbody > tr').forEach((tr) => {
      let col = 0
      for (const td of tr.children) { const n = nombres[col] || ''; if (td.dataset.label !== n) td.dataset.label = n; col += td.colSpan || 1 }
    })
  })
}
new MutationObserver(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(etiquetarTablas) } })
  .observe(document.getElementById('root'), { childList: true, subtree: true, characterData: true })

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Burbujas /><App /></React.StrictMode>)
