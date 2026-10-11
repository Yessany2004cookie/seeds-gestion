import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Burbujas from './burbujas.jsx'
import './glass.css'
// El brillo de los botones de burbuja sigue al dedo o al mouse
document.addEventListener('pointermove', (e) => {
  const b = e.target.closest?.('button'); if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--x', `${e.clientX - r.left}px`); b.style.setProperty('--y', `${e.clientY - r.top}px`);
}, { passive: true })
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Burbujas /><App /></React.StrictMode>)
