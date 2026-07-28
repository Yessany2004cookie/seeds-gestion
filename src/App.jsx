import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  LogIn, LogOut, Users, BookOpen, FileText, CreditCard, Bell,
  Plus, Trash2, Edit, Search, Calendar, X, Eye,
  Send, Home, UserPlus, GraduationCap, Phone, Mail, DollarSign,
  Check, AlertCircle, Menu, RefreshCw, Download, Upload
} from "lucide-react";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TIPOS_PAGO = [{value:"efectivo",label:"Efectivo"},{value:"transferencia",label:"Transferencia"},{value:"tarjeta",label:"Tarjeta"},{value:"deposito",label:"Depósito"}];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ── Normaliza teléfono para WhatsApp (Honduras) ──
// Detecta solo si el número ya trae el código de país 504 o no.
// Acepta: "9765-4321", "+504 9765 4321", "50497654321", "00504...", etc.
const telWA = (tel) => {
  if(!tel) return "";
  let d = String(tel).replace(/[^0-9]/g, "");  // dejar solo dígitos
  if(d.startsWith("00")) d = d.slice(2);        // 0050497654321 → 50497654321
  if(d.length === 8) d = "504" + d;             // 97654321 → 50497654321
  return d;                                      // si ya trae 504, se deja igual
};
// Muestra el número bonito para que se vea en pantalla
const telBonito = (tel) => { const d = telWA(tel); return d ? `+${d}` : "—"; };

// ── Abrir WhatsApp ──
// Usa el protocolo "whatsapp://" que abre DIRECTO la app de WhatsApp
// instalada (escritorio o celular), sin pasar por la página web intermedia.
const abrirWhatsApp = (tel, texto="") => {
  const num = telWA(tel);
  if(!num) return false;
  const q = texto ? `&text=${encodeURIComponent(texto)}` : "";
  const a = document.createElement('a');
  a.href = `whatsapp://send?phone=${num}${q}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};
// Alternativa si la app no abre: WhatsApp Web
const linkWhatsAppWeb = (tel, texto="") => {
  const num = telWA(tel);
  const q = texto ? `&text=${encodeURIComponent(texto)}` : "";
  return `https://web.whatsapp.com/send?phone=${num}${q}`;
};

// ── Cálculo de mora (recargo por atraso) ──
// Ahora el recargo es un PORCENTAJE de la mensualidad, configurable por sección,
// y se ACUMULA: por cada mes de atraso se suma otro tanto del porcentaje.
// Ej: sección con 12%, factura de L 1000 con 2 meses de atraso → 12%+12% = 24% = L 240.
// Necesita la lista de secciones para saber el % de la sección del alumno.
const calcMora = (f, secciones=[], alumnos=[]) => {
  if (!f || f.estado === "pagada" || f.estado === "anulada" || f.tipo_factura === "comprobante") return 0;
  // Ubicar la sección del alumno de esta factura
  const al = alumnos.find(a => a.id === f.alumno_id);
  const sec = al ? secciones.find(s => s.id === al.seccion_id) : null;
  // Si la sección no tiene mora activa o el % es 0, no hay recargo
  if (!sec || sec.mora_activa !== true || !Number(sec.mora_porcentaje)) return 0;
  const hoy = new Date();
  const mesIdx = MESES.indexOf(f.mes_correspondiente);
  if (mesIdx === -1) return 0;
  const year = parseInt(String(f.fecha_emision||"").split("-")[0]) || hoy.getFullYear();
  const deadline = new Date(year, mesIdx, 28, 23, 59, 59);
  if (hoy <= deadline) return 0;
  // Cuántos meses de atraso (mínimo 1 pasado el día 28)
  const mesesAtraso = Math.max(1, Math.ceil((hoy - deadline) / (1000*60*60*24*30)));
  const pct = Number(sec.mora_porcentaje) / 100;
  const recargo = Number(f.monto_total) * pct * mesesAtraso;
  return Math.round(recargo);
};

// ── Capa de base de datos (Supabase) ──
const db = {
  async all(table){ const {data,error}=await supabase.from(table).select("*").order("created_at",{ascending:true}); if(error)throw error; return data||[]; },
  async insert(table,row){ const {error}=await supabase.from(table).insert(row); if(error)throw error; },
  async insertMany(table,rows){ const {error}=await supabase.from(table).insert(rows); if(error)throw error; },
  async update(table,id,changes){ const {error}=await supabase.from(table).update(changes).eq("id",id); if(error)throw error; },
  async remove(table,id){ const {error}=await supabase.from(table).delete().eq("id",id); if(error)throw error; },
  async upsertMany(table,rows){ const {error}=await supabase.from(table).upsert(rows); if(error)throw error; },
};

// ── Imagen de factura (Canvas) ──
const generarImgFactura = (f, al, padre, sec, mora, tipo) => {
  const esPago = tipo === "comprobante";
  const cv = document.createElement('canvas'); cv.width=600; cv.height=720;
  const c = cv.getContext('2d');
  c.fillStyle='#fff'; c.fillRect(0,0,600,720);
  c.fillStyle=esPago?'#059669':'#1E293B'; c.fillRect(0,0,600,90);
  c.fillStyle=esPago?'#fff':'#F97316'; c.font='bold 24px Segoe UI,system-ui,sans-serif';
  c.textAlign='center'; c.fillText('Seeds English School',300,38);
  c.fillStyle=esPago?'#D1FAE5':'#94A3B8'; c.font='12px Segoe UI,sans-serif';
  c.fillText('Jesús de Otoro, Intibucá, Honduras',300,60);
  c.fillStyle=esPago?'#fff':'#CBD5E1'; c.font='11px Segoe UI,sans-serif';
  c.fillText(String(f.fecha_emision||''),300,78);
  c.fillStyle=esPago?'#059669':'#F97316'; c.fillRect(0,90,600,4);
  c.fillStyle=esPago?'#059669':'#F97316'; c.font='bold 20px Segoe UI,sans-serif';
  c.fillText(esPago?'COMPROBANTE DE PAGO':'FACTURA DE COBRO',300,125);
  c.fillStyle='#1E293B'; c.font='bold 16px Segoe UI,sans-serif';
  c.fillText(f.numero_factura,300,150);
  c.strokeStyle='#E2E8F0'; c.lineWidth=1;
  c.beginPath(); c.moveTo(40,168); c.lineTo(560,168); c.stroke();
  c.textAlign='left'; c.fillStyle='#F97316'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('DATOS DEL ALUMNO',50,192);
  c.fillStyle='#334155'; c.font='13px Segoe UI,sans-serif';
  c.fillText(`Alumno:   ${al?.nombre||'—'}`,50,214);
  c.fillText(`Padre:    ${padre?.nombre||'—'}`,50,234);
  c.fillText(`Teléfono: ${padre?.telefono||'—'}`,50,254);
  c.fillText(`Sección:  ${sec?.nombre||'—'}`,50,274);
  c.fillStyle='#F97316'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('DETALLE',350,192);
  c.fillStyle='#334155'; c.font='13px Segoe UI,sans-serif';
  c.fillText(`Mes: ${f.mes_correspondiente}`,350,214);
  if(esPago){c.fillText(`Fecha pago: ${f.fecha_pago||'—'}`,350,234);c.fillText(`Tipo pago: ${f.tipo_pago}`,350,254);}
  else{c.fillText(`Límite: 28 de ${f.mes_correspondiente}`,350,234);}
  c.beginPath(); c.moveTo(40,300); c.lineTo(560,300); c.stroke();
  c.fillStyle='#F1F5F9'; c.fillRect(40,310,520,32);
  c.fillStyle='#475569'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('Concepto',55,331);
  c.textAlign='right'; c.fillText('Monto',545,331);
  c.textAlign='left'; c.fillStyle='#1E293B'; c.font='14px Segoe UI,sans-serif';
  c.fillText(`Mensualidad ${f.mes_correspondiente}`,55,365);
  c.textAlign='right'; c.fillText(`L ${(f.monto_total||0).toLocaleString()}`,545,365);
  let y=390;
  if(mora>0){c.textAlign='left';c.fillStyle='#DC2626';c.fillText('Mora por atraso',55,y);c.textAlign='right';c.fillText(`L ${mora.toLocaleString()}`,545,y);y+=30;}
  c.beginPath();c.moveTo(40,y+5);c.lineTo(560,y+5);c.stroke();
  y+=15;
  c.fillStyle=esPago?'#059669':'#F97316'; c.fillRect(40,y,520,50);
  c.fillStyle='#fff'; c.font='bold 20px Segoe UI,sans-serif';
  c.textAlign='left'; c.fillText(esPago?'TOTAL PAGADO:':'TOTAL A PAGAR:',60,y+32);
  c.textAlign='right'; c.fillText(`L ${((f.monto_total||0)+mora).toLocaleString()}`,540,y+32);
  y+=70;
  if(esPago){
    c.save();c.translate(300,y+30);c.rotate(-0.15);
    c.strokeStyle='#059669';c.lineWidth=4;c.font='bold 48px Segoe UI,sans-serif';c.textAlign='center';
    c.strokeText('✓ PAGADO',0,0);c.restore();y+=60;
  }
  c.fillStyle='#64748B'; c.font='11px Segoe UI,sans-serif'; c.textAlign='center';
  if(!esPago) c.fillText('Envíe su comprobante de pago al número de administración.',300,y+15);
  c.fillText('Seeds English School 🌱',300,y+(esPago?15:35));
  c.strokeStyle='#E2E8F0'; c.lineWidth=2; c.strokeRect(1,1,598,718);
  return cv.toDataURL('image/png');
};

// ── Imagen de factura de MATERIAL (cobro o comprobante) ──
const generarImgMaterial = (v, al, padre, sec, tipo) => {
  const esPago = tipo === "comprobante";
  const cv = document.createElement('canvas'); cv.width=600; cv.height=560;
  const c = cv.getContext('2d');
  c.fillStyle='#fff'; c.fillRect(0,0,600,560);
  c.fillStyle=esPago?'#059669':'#D97706'; c.fillRect(0,0,600,84);
  c.fillStyle='#fff'; c.font='bold 22px Segoe UI,sans-serif'; c.textAlign='center';
  c.fillText('Seeds English School',300,34);
  c.fillStyle=esPago?'#D1FAE5':'#FEF3C7'; c.font='12px Segoe UI,sans-serif';
  c.fillText('Jesús de Otoro, Intibucá, Honduras',300,55);
  c.fillStyle='#fff'; c.font='11px Segoe UI,sans-serif';
  c.fillText(String(v.fecha_venta||''),300,74);
  c.fillStyle=esPago?'#059669':'#D97706'; c.fillRect(0,84,600,4);
  c.fillStyle=esPago?'#059669':'#D97706'; c.font='bold 19px Segoe UI,sans-serif';
  c.fillText(esPago?'COMPROBANTE DE MATERIAL':'COBRO DE MATERIAL',300,116);
  c.fillStyle='#1E293B'; c.font='bold 15px Segoe UI,sans-serif';
  c.fillText(v.numero,300,140);
  c.strokeStyle='#E2E8F0'; c.lineWidth=1;
  c.beginPath(); c.moveTo(40,158); c.lineTo(560,158); c.stroke();
  c.textAlign='left'; c.fillStyle=esPago?'#059669':'#D97706'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('DATOS DEL ALUMNO',50,182);
  c.fillStyle='#334155'; c.font='13px Segoe UI,sans-serif';
  c.fillText(`Alumno:   ${al?.nombre||'—'}`,50,204);
  c.fillText(`Padre:    ${padre?.nombre||'—'}`,50,224);
  c.fillText(`Teléfono: ${padre?.telefono||'—'}`,50,244);
  c.fillText(`Sección:  ${sec?.nombre||'—'}`,50,264);
  c.fillStyle=esPago?'#059669':'#D97706'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('DETALLE',350,182);
  c.fillStyle='#334155'; c.font='13px Segoe UI,sans-serif';
  c.fillText(`Mes: ${v.mes_correspondiente||'—'}`,350,204);
  if(esPago){c.fillText(`Fecha pago: ${v.fecha_pago||v.fecha_venta||'—'}`,350,224);c.fillText(`Tipo pago: ${v.tipo_pago||'—'}`,350,244);}
  c.beginPath(); c.moveTo(40,288); c.lineTo(560,288); c.stroke();
  c.fillStyle='#F1F5F9'; c.fillRect(40,298,520,32);
  c.fillStyle='#475569'; c.font='bold 12px Segoe UI,sans-serif';
  c.fillText('Material',55,319); c.textAlign='center'; c.fillText('Cant.',360,319);
  c.textAlign='right'; c.fillText('Total',545,319);
  c.textAlign='left'; c.fillStyle='#1E293B'; c.font='14px Segoe UI,sans-serif';
  c.fillText(v.nombre_material||'Material',55,353);
  c.textAlign='center'; c.fillText(String(v.cantidad||1),360,353);
  c.textAlign='right'; c.fillText(`L ${Number(v.precio_venta).toLocaleString()}`,545,353);
  let y=378;
  c.beginPath();c.moveTo(40,y);c.lineTo(560,y);c.stroke();y+=12;
  c.fillStyle=esPago?'#059669':'#D97706'; c.fillRect(40,y,520,48);
  c.fillStyle='#fff'; c.font='bold 20px Segoe UI,sans-serif';
  c.textAlign='left'; c.fillText(esPago?'TOTAL PAGADO:':'TOTAL A PAGAR:',60,y+31);
  c.textAlign='right'; c.fillText(`L ${Number(v.precio_venta).toLocaleString()}`,540,y+31);
  y+=68;
  if(esPago){
    c.save();c.translate(300,y+20);c.rotate(-0.13);
    c.strokeStyle='#059669';c.lineWidth=4;c.font='bold 44px Segoe UI,sans-serif';c.textAlign='center';
    c.strokeText('✓ PAGADO',0,0);c.restore();y+=50;
  }
  c.fillStyle='#64748B'; c.font='11px Segoe UI,sans-serif'; c.textAlign='center';
  c.fillText('Seeds English School 🌱',300,y+15);
  c.strokeStyle='#E2E8F0'; c.lineWidth=2; c.strokeRect(1,1,598,558);
  return cv.toDataURL('image/png');
};
//  APP PRINCIPAL
// ══════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState({ maestros:[], secciones:[], padres:[], alumnos:[], facturas:[], gastos:[], materiales:[], ventas_material:[] });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  // Sesión de Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => { setSession(session); setLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Cargar todos los datos
  const loadData = useCallback(async () => {
    try {
      const [maestros,secciones,padres,alumnos,facturas,gastos,materiales,ventas_material] = await Promise.all([
        db.all("maestros"), db.all("secciones"), db.all("padres"),
        db.all("alumnos"), db.all("facturas"), db.all("gastos"),
        db.all("materiales"), db.all("ventas_material")
      ]);
      setData({maestros,secciones,padres,alumnos,facturas,gastos,materiales,ventas_material});
    } catch(e) { showToast("Error cargando datos: "+e.message,"error"); }
  }, []);

  useEffect(() => { if(session) loadData(); }, [session, loadData]);

  const logout = async () => { await supabase.auth.signOut(); setSession(null); };

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F8FAFC"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🌱</div><p style={{color:"#64748B"}}>Cargando Seeds...</p></div></div>;
  if (!session) return <LoginPage showToast={showToast} toast={toast} />;

  const NAV = [
    {id:"dashboard",label:"Inicio",icon:Home},{id:"secciones",label:"Secciones",icon:BookOpen},
    {id:"maestros",label:"Maestros",icon:GraduationCap},{id:"alumnos",label:"Matrícula",icon:Users},
    {id:"facturas",label:"Facturas",icon:FileText},{id:"materiales",label:"Materiales",icon:CreditCard},
    {id:"historial",label:"Historial",icon:Calendar},{id:"recordatorios",label:"Recordatorios",icon:Bell},
    {id:"finanzas",label:"Finanzas",icon:DollarSign},{id:"reportes",label:"Reportes",icon:FileText},
    {id:"config",label:"Configuración",icon:Edit},{id:"sistema",label:"Sistema",icon:LogIn},
  ];

  const props = { data, loadData, showToast };
  const pageMap = {
    dashboard:<Dashboard data={data} setPage={setPage}/>,
    secciones:<SeccionesPage {...props}/>,
    maestros:<MaestrosPage {...props}/>,
    alumnos:<AlumnosPage {...props}/>,
    facturas:<FacturasPage {...props}/>,
    materiales:<MaterialesPage {...props}/>,
    historial:<HistorialPage {...props}/>,
    recordatorios:<RecordatoriosPage {...props}/>,
    finanzas:<FinanzasPage {...props}/>,
    reportes:<ReportesPage {...props}/>,
    config:<ConfiguracionPage {...props}/>,
    sistema:<SistemaPage data={data} loadData={loadData} showToast={showToast} session={session}/>,
  };

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#F1F5F9"}}>
      {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:40}}/>}
      <aside style={{position:"fixed",left:sidebarOpen?0:-260,top:0,bottom:0,width:250,background:"#1E293B",color:"#fff",zIndex:50,transition:"left 0.2s",display:"flex",flexDirection:"column",...(window.innerWidth>768?{position:"relative",left:0}:{})}}>
        <div style={{padding:"20px 16px",borderBottom:"1px solid #334155",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🌱</span>
          <div><div style={{fontWeight:700,fontSize:15,color:"#F97316"}}>Seeds English</div><div style={{fontSize:11,color:"#94A3B8"}}>Sistema de Gestión</div></div>
        </div>
        <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
          {NAV.map(n=>{const Icon=n.icon;const a=page===n.id;return(
            <button key={n.id} onClick={()=>{setPage(n.id);setSidebarOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 16px",border:"none",cursor:"pointer",background:a?"#334155":"transparent",color:a?"#F97316":"#CBD5E1",fontSize:13,fontWeight:a?600:400,textAlign:"left",borderLeft:a?"3px solid #F97316":"3px solid transparent",fontFamily:"inherit"}}><Icon size={17}/>{n.label}</button>
          );})}
        </nav>
        <button onClick={logout} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",border:"none",borderTop:"1px solid #334155",background:"transparent",color:"#EF4444",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}><LogOut size={16}/>Cerrar sesión</button>
      </aside>
      <main style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:"#fff",padding:"12px 20px",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {window.innerWidth<=768&&<button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Menu size={22} color="#475569"/></button>}
            <h1 style={{fontSize:17,fontWeight:700,color:"#1E293B",margin:0}}>{NAV.find(n=>n.id===page)?.label||""}</h1>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>{loadData();showToast("Datos actualizados");}} title="Refrescar datos" style={{background:"none",border:"1px solid #E2E8F0",borderRadius:6,cursor:"pointer",padding:"5px 8px",display:"flex",alignItems:"center"}}><RefreshCw size={14} color="#64748B"/></button>
            <div style={{fontSize:12,color:"#64748B"}}>{session.user.email}</div>
          </div>
        </header>
        <div style={{flex:1,overflow:"auto",padding:20}}>{pageMap[page]}</div>
      </main>
      {toast&&<div style={{position:"fixed",bottom:20,right:20,padding:"12px 20px",background:toast.type==="success"?"#059669":"#DC2626",color:"#fff",borderRadius:8,fontSize:13,fontWeight:500,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",zIndex:999,maxWidth:320}}>{toast.msg}</div>}
    </div>
  );
}

// ── ESTILOS ──
const card={background:"#fff",borderRadius:10,border:"1px solid #E2E8F0",padding:20,marginBottom:16};
const input={width:"100%",padding:"9px 12px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const btn=(c="#F97316")=>({padding:"9px 18px",background:c,color:"#fff",border:"none",borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6});
const btnO={padding:"8px 14px",background:"transparent",color:"#64748B",border:"1px solid #D1D5DB",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5};
const label={fontSize:12,fontWeight:600,color:"#475569",marginBottom:4,display:"block"};
const badge=(c)=>({padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:c+"18",color:c});

// ── LOGIN (Supabase Auth) ──
function LoginPage({showToast,toast}){
  const[email,setEmail]=useState("");const[pass,setPass]=useState("");const[error,setError]=useState("");const[show,setShow]=useState(false);const[busy,setBusy]=useState(false);
  const go=async()=>{
    if(!email||!pass){setError("Completa todos los campos");return;}
    setBusy(true);setError("");
    const {error}=await supabase.auth.signInWithPassword({email,password:pass});
    setBusy(false);
    if(error)setError("Credenciales incorrectas o usuario no existe");
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1E293B,#0F172A)",padding:20,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px 36px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:48,marginBottom:8}}>🌱</div><h1 style={{fontSize:22,fontWeight:800,color:"#1E293B",margin:0}}>Seeds English School</h1><p style={{fontSize:13,color:"#64748B",margin:"6px 0 0"}}>Sistema de Gestión Escolar</p></div>
        <div style={{marginBottom:16}}><label style={label}>Correo electrónico</label><div style={{position:"relative"}}><Mail size={16} style={{position:"absolute",left:10,top:11,color:"#94A3B8"}}/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" type="email" style={{...input,paddingLeft:34}} onKeyDown={e=>e.key==="Enter"&&go()}/></div></div>
        <div style={{marginBottom:20}}><label style={label}>Contraseña</label><div style={{position:"relative"}}><LogIn size={16} style={{position:"absolute",left:10,top:11,color:"#94A3B8"}}/><input value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" type={show?"text":"password"} style={{...input,paddingLeft:34}} onKeyDown={e=>e.key==="Enter"&&go()}/><button onClick={()=>setShow(!show)} style={{position:"absolute",right:8,top:7,background:"none",border:"none",cursor:"pointer",color:"#94A3B8"}}><Eye size={16}/></button></div></div>
        {error&&<div style={{padding:"8px 12px",background:"#FEF2F2",color:"#DC2626",borderRadius:6,fontSize:12,marginBottom:14,display:"flex",alignItems:"center",gap:6}}><AlertCircle size={14}/>{error}</div>}
        <button onClick={go} disabled={busy} style={{...btn(),width:"100%",padding:"11px",justifyContent:"center",fontSize:14,opacity:busy?0.7:1}}><LogIn size={16}/>{busy?"Ingresando...":"Iniciar Sesión"}</button>
        <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:16}}>Los usuarios se crean en el panel de Supabase (Authentication)</p>
      </div>
    </div>
  );
}

// ── DASHBOARD ──
function Dashboard({data,setPage}){
  const ta=data.alumnos.filter(a=>a.estado==="activo").length;
  const ts=data.secciones.filter(s=>s.activa!==false).length;
  const pend=data.facturas.filter(f=>(f.estado==="pendiente"||f.estado==="parcial")&&(f.tipo_factura||"cobro")==="cobro").length;
  const mes=MESES[new Date().getMonth()];
  const ingMens=data.facturas.filter(f=>f.tipo_factura==="comprobante"&&f.mes_correspondiente===mes).reduce((s,f)=>s+(Number(f.monto_total)||0),0);
  const ventMat=(data.ventas_material||[]).filter(v=>v.mes_correspondiente===mes&&v.estado==="pagado");
  const ingMat=ventMat.reduce((s,v)=>s+Number(v.precio_venta),0);
  const ganMat=ventMat.reduce((s,v)=>s+Number(v.ganancia),0);
  const ing=ingMens+ingMat;
  const gastos=data.gastos.filter(g=>g.mes_correspondiente===mes).reduce((s,g)=>s+(Number(g.monto)||0),0);
  const ganancia=ingMens+ganMat-gastos;
  const stats=[{l:"Alumnos activos",v:ta,c:"#2563EB",i:Users,p:"alumnos"},{l:"Secciones",v:ts,c:"#F97316",i:BookOpen,p:"secciones"},{l:"Cobros pendientes",v:pend,c:"#DC2626",i:AlertCircle,p:"facturas"},{l:`Ingresos ${mes}`,v:`L ${ing.toLocaleString()}`,c:"#059669",i:DollarSign,p:"finanzas"},{l:`Gastos ${mes}`,v:`L ${gastos.toLocaleString()}`,c:"#DC2626",i:CreditCard,p:"finanzas"},{l:`Ganancia ${mes}`,v:`L ${ganancia.toLocaleString()}`,c:ganancia>=0?"#059669":"#DC2626",i:DollarSign,p:"finanzas"}];
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
      {stats.map((s,i)=>{const Icon=s.i;return(<div key={i} onClick={()=>setPage(s.p)} style={{...card,cursor:"pointer",padding:18,display:"flex",alignItems:"center",gap:14,borderLeft:`3px solid ${s.c}`}}><div style={{background:s.c+"14",borderRadius:10,padding:10}}><Icon size={22} color={s.c}/></div><div><div style={{fontSize:20,fontWeight:800,color:"#1E293B"}}>{s.v}</div><div style={{fontSize:12,color:"#64748B"}}>{s.l}</div></div></div>);})}
    </div>
    <div style={card}><h3 style={{fontSize:15,fontWeight:700,color:"#1E293B",margin:"0 0 14px"}}>Acciones rápidas</h3><div style={{display:"flex",flexWrap:"wrap",gap:10}}><button onClick={()=>setPage("alumnos")} style={btn("#2563EB")}><UserPlus size={15}/>Nueva matrícula</button><button onClick={()=>setPage("facturas")} style={btn("#059669")}><FileText size={15}/>Crear cobros</button><button onClick={()=>setPage("recordatorios")} style={btn("#7C3AED")}><Bell size={15}/>Recordatorios</button></div></div>
  </div>);
}

// ── SECCIONES ──
function SeccionesPage({data,loadData,showToast}){
  const[modal,setModal]=useState(null);const[form,setForm]=useState({nombre:"",horario:"",descripcion:"",mensualidad:""});
  const open=(s=null)=>{setForm(s?{nombre:s.nombre,horario:s.horario||"",descripcion:s.descripcion||"",mensualidad:s.mensualidad||""}:{nombre:"",horario:"",descripcion:"",mensualidad:""});setModal(s?.id||"new");};
  const sv=async()=>{
    if(!form.nombre)return;
    try{
      const row={nombre:form.nombre,horario:form.horario,descripcion:form.descripcion,mensualidad:parseFloat(form.mensualidad)||0};
      if(modal==="new"){await db.insert("secciones",{id:uid(),...row,activa:true});showToast("Sección creada");}
      else{await db.update("secciones",modal,row);showToast("Actualizada");}
      await loadData();setModal(null);
    }catch(e){showToast("Error: "+e.message,"error");}
  };
  const del=async(id)=>{
    if(!confirm("¿Eliminar esta sección?"))return;
    try{await db.remove("secciones",id);await loadData();showToast("Eliminada","error");}
    catch(e){showToast("No se puede eliminar (tiene alumnos)","error");}
  };
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><p style={{fontSize:13,color:"#64748B",margin:0}}>{data.secciones.length} secciones</p><button onClick={()=>open()} style={btn()}><Plus size={15}/>Nueva sección</button></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
      {data.secciones.map(s=>{const ac=data.alumnos.filter(a=>a.seccion_id===s.id&&a.estado==="activo").length;return(<div key={s.id} style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}><div><h3 style={{fontSize:15,fontWeight:700,color:"#1E293B",margin:0}}>{s.nombre}</h3>{s.horario&&<p style={{fontSize:12,color:"#64748B",margin:"4px 0 0"}}>{s.horario}</p>}</div><div style={{display:"flex",gap:4}}><button onClick={()=>open(s)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Edit size={15} color="#64748B"/></button><button onClick={()=>del(s.id)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash2 size={15} color="#EF4444"/></button></div></div><div style={{marginTop:12,display:"flex",gap:12}}><span style={{...badge("#2563EB"),display:"flex",alignItems:"center",gap:4}}><Users size={12}/>{ac}</span><span style={{...badge("#059669"),display:"flex",alignItems:"center",gap:4}}><DollarSign size={12}/>L {(Number(s.mensualidad)||0).toLocaleString()}</span></div>{s.descripcion&&<p style={{fontSize:12,color:"#94A3B8",margin:"10px 0 0"}}>{s.descripcion}</p>}</div>);})}
    </div>
    {modal&&<Modal title={modal==="new"?"Nueva sección":"Editar sección"} onClose={()=>setModal(null)} onSave={sv}><Field label="Nombre" value={form.nombre} onChange={v=>setForm({...form,nombre:v})} placeholder="Ej: Grupo A"/><Field label="Horario" value={form.horario} onChange={v=>setForm({...form,horario:v})} placeholder="Lun-Mié 3-4 PM"/><Field label="Mensualidad (L)" value={form.mensualidad} onChange={v=>setForm({...form,mensualidad:v})} type="number"/><Field label="Descripción" value={form.descripcion} onChange={v=>setForm({...form,descripcion:v})} multiline/></Modal>}
  </div>);
}

// ── MAESTROS ──
function MaestrosPage({data,loadData,showToast}){
  const[modal,setModal]=useState(null);const[form,setForm]=useState({nombre:"",telefono:"",email:"",secciones_ids:[],salario:""});
  const open=(m=null)=>{setForm(m?{nombre:m.nombre,telefono:m.telefono||"",email:m.email||"",secciones_ids:m.secciones_ids||[],salario:m.salario||""}:{nombre:"",telefono:"",email:"",secciones_ids:[],salario:""});setModal(m?.id||"new");};
  const sv=async()=>{
    if(!form.nombre)return;
    try{
      const row={nombre:form.nombre,telefono:form.telefono,email:form.email,secciones_ids:form.secciones_ids,salario:parseFloat(form.salario)||0};
      if(modal==="new"){await db.insert("maestros",{id:uid(),...row});showToast("Registrado");}
      else{await db.update("maestros",modal,row);showToast("Actualizado");}
      await loadData();setModal(null);
    }catch(e){showToast("Error: "+e.message,"error");}
  };
  const del=async(id)=>{if(!confirm("¿Eliminar maestro?"))return;try{await db.remove("maestros",id);await loadData();showToast("Eliminado","error");}catch(e){showToast("Error: "+e.message,"error");}};
  const tog=(sid)=>{const ids=form.secciones_ids.includes(sid)?form.secciones_ids.filter(id=>id!==sid):[...form.secciones_ids,sid];setForm({...form,secciones_ids:ids});};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><p style={{fontSize:13,color:"#64748B",margin:0}}>{data.maestros.length} maestros</p><button onClick={()=>open()} style={btn("#2563EB")}><Plus size={15}/>Nuevo maestro</button></div>
    <div style={card}>{data.maestros.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay maestros</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["Nombre","Teléfono","Email","Salario","Secciones",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#64748B",fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{data.maestros.map(m=>(<tr key={m.id} style={{borderBottom:"1px solid #F1F5F9"}}><td style={{padding:"8px 10px",fontWeight:600}}>{m.nombre}</td><td style={{padding:"8px 10px"}}>{m.telefono||"—"}</td><td style={{padding:"8px 10px"}}>{m.email||"—"}</td><td style={{padding:"8px 10px",fontWeight:600,color:"#059669"}}>{m.salario?`L ${Number(m.salario).toLocaleString()}`:"—"}</td><td style={{padding:"8px 10px"}}>{(m.secciones_ids||[]).map(sid=>{const sec=data.secciones.find(s=>s.id===sid);return sec?<span key={sid} style={{...badge("#F97316"),marginRight:4}}>{sec.nombre}</span>:null;})}{(!m.secciones_ids||m.secciones_ids.length===0)&&"—"}</td><td style={{padding:"8px 10px"}}><button onClick={()=>open(m)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Edit size={15} color="#64748B"/></button><button onClick={()=>del(m.id)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Trash2 size={15} color="#EF4444"/></button></td></tr>))}</tbody></table></div>)}</div>
    {modal&&<Modal title={modal==="new"?"Nuevo maestro":"Editar maestro"} onClose={()=>setModal(null)} onSave={sv}><Field label="Nombre" value={form.nombre} onChange={v=>setForm({...form,nombre:v})}/><Field label="Teléfono" value={form.telefono} onChange={v=>setForm({...form,telefono:v})}/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})} type="email"/><Field label="Salario mensual (L)" value={form.salario} onChange={v=>setForm({...form,salario:v})} type="number" placeholder="Ej: 5000"/><div><label style={label}>Secciones</label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{data.secciones.map(s=>(<button key={s.id} onClick={()=>tog(s.id)} style={{padding:"6px 12px",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"inherit",border:form.secciones_ids.includes(s.id)?"2px solid #F97316":"1px solid #D1D5DB",background:form.secciones_ids.includes(s.id)?"#FFF7ED":"#fff",color:form.secciones_ids.includes(s.id)?"#F97316":"#64748B",fontWeight:form.secciones_ids.includes(s.id)?600:400}}>{form.secciones_ids.includes(s.id)&&<Check size={12} style={{marginRight:4}}/>}{s.nombre}</button>))}{data.secciones.length===0&&<p style={{fontSize:12,color:"#94A3B8"}}>Crea secciones primero</p>}</div></div></Modal>}
  </div>);
}

// ── MATRÍCULA ──
function AlumnosPage({data,loadData,showToast}){
  const[modal,setModal]=useState(null);const[search,setSearch]=useState("");const[filterSec,setFilterSec]=useState("");
  const[form,setForm]=useState({nombre:"",telefono:"",email:"",padre_nombre:"",padre_telefono:"",padre_email:"",seccion_id:"",padre_id:"",monto_personalizado:"",beca:false});
  const open=(al=null)=>{if(al){const p=data.padres.find(p=>p.id===al.padre_id)||{};setForm({nombre:al.nombre,telefono:al.telefono||"",email:al.email||"",padre_nombre:p.nombre||"",padre_telefono:p.telefono||"",padre_email:p.email||"",seccion_id:al.seccion_id||"",padre_id:al.padre_id||"",monto_personalizado:al.monto_personalizado||"",beca:al.beca===true});}else{setForm({nombre:"",telefono:"",email:"",padre_nombre:"",padre_telefono:"",padre_email:"",seccion_id:"",padre_id:"",monto_personalizado:"",beca:false});}setModal(al?.id||"new");};
  const sv=async()=>{
    if(!form.nombre||!form.padre_nombre){showToast("Nombre del alumno y padre requeridos","error");return;}
    try{
      let padreId=form.padre_id;
      const padreRow={nombre:form.padre_nombre,telefono:form.padre_telefono,email:form.padre_email};
      if(padreId){await db.update("padres",padreId,padreRow);}
      else{padreId=uid();await db.insert("padres",{id:padreId,...padreRow});}
      const alRow={nombre:form.nombre,telefono:form.telefono,email:form.email,padre_id:padreId,seccion_id:form.seccion_id||null,monto_personalizado:form.beca?0:(parseFloat(form.monto_personalizado)||0),beca:form.beca===true};
      if(modal==="new"){await db.insert("alumnos",{id:uid(),...alRow,estado:"activo",fecha_ingreso:new Date().toISOString().split("T")[0]});showToast("Alumno matriculado");}
      else{await db.update("alumnos",modal,alRow);showToast("Actualizado");}
      await loadData();setModal(null);
    }catch(e){showToast("Error: "+e.message,"error");}
  };
  const toggleEstado=async(a)=>{try{await db.update("alumnos",a.id,{estado:a.estado==="activo"?"inactivo":"activo"});await loadData();}catch(e){showToast("Error: "+e.message,"error");}};
  const filtered=data.alumnos.filter(a=>(!search||a.nombre.toLowerCase().includes(search.toLowerCase()))&&(!filterSec||a.seccion_id===filterSec));
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:10,top:10,color:"#94A3B8"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...input,paddingLeft:32,width:200}}/></div><select value={filterSec} onChange={e=>setFilterSec(e.target.value)} style={{...input,width:180,cursor:"pointer"}}><option value="">Todas las secciones</option>{data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
      <button onClick={()=>open()} style={btn("#2563EB")}><UserPlus size={15}/>Matricular</button>
    </div>
    <div style={card}>{filtered.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay alumnos</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:600}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["Alumno","Padre","Tel. Padre","Sección","Monto","Estado",""].map(h=><th key={h} style={{textAlign:h===""?"center":"left",padding:"8px 10px",color:"#64748B",fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead><tbody>{filtered.map(a=>{const p=data.padres.find(p=>p.id===a.padre_id);const sec=data.secciones.find(s=>s.id===a.seccion_id);const sc={activo:"#059669",inactivo:"#DC2626",graduado:"#7C3AED"};const m=(Number(a.monto_personalizado)>0)?Number(a.monto_personalizado):Number(sec?.mensualidad)||0;return(<tr key={a.id} style={{borderBottom:"1px solid #F1F5F9"}}><td style={{padding:"8px 10px"}}><div style={{fontWeight:600}}>{a.nombre}</div>{a.telefono&&<div style={{fontSize:11,color:"#94A3B8"}}>{a.telefono}</div>}</td><td style={{padding:"8px 10px"}}>{p?.nombre||"—"}</td><td style={{padding:"8px 10px"}}>{p?.telefono||"—"}</td><td style={{padding:"8px 10px"}}>{sec?<span style={badge("#F97316")}>{sec.nombre}</span>:"—"}</td><td style={{padding:"8px 10px"}}>{a.beca?<span style={badge("#7C3AED")}>🎓 Becado</span>:(m?<span style={{fontWeight:600,color:Number(a.monto_personalizado)>0?"#7C3AED":"#1E293B"}}>L {m.toLocaleString()}{Number(a.monto_personalizado)>0?" ✎":""}</span>:"—")}</td><td style={{padding:"8px 10px"}}><span style={badge(sc[a.estado]||"#64748B")}>{a.estado}</span></td><td style={{padding:"8px 10px",textAlign:"center"}}><button onClick={()=>open(a)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Edit size={15} color="#64748B"/></button><button onClick={()=>toggleEstado(a)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{a.estado==="activo"?<X size={15} color="#DC2626"/>:<Check size={15} color="#059669"/>}</button></td></tr>);})}</tbody></table></div>)}</div>
    {modal&&<Modal title={modal==="new"?"Matricular alumno":"Editar alumno"} onClose={()=>setModal(null)} onSave={sv} wide><div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}><div><h4 style={{fontSize:13,fontWeight:700,color:"#F97316",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6}}><Users size={15}/>Alumno</h4><Field label="Nombre *" value={form.nombre} onChange={v=>setForm({...form,nombre:v})}/><Field label="Teléfono" value={form.telefono} onChange={v=>setForm({...form,telefono:v})}/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})} type="email"/><div style={{marginBottom:12}}><label style={label}>Sección</label><select value={form.seccion_id} onChange={e=>setForm({...form,seccion_id:e.target.value})} style={{...input,cursor:"pointer"}}><option value="">Sin sección</option>{data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre} — L {s.mensualidad}</option>)}</select></div>

            {/* Opción de BECA */}
            <div onClick={()=>setForm({...form,beca:!form.beca,monto_personalizado:!form.beca?"":form.monto_personalizado})} style={{marginBottom:12,padding:"10px 12px",borderRadius:8,cursor:"pointer",border:form.beca?"2px solid #7C3AED":"1px solid #D1D5DB",background:form.beca?"#F5F3FF":"#fff",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:20,height:20,borderRadius:5,border:form.beca?"none":"2px solid #D1D5DB",background:form.beca?"#7C3AED":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {form.beca&&<Check size={14} color="#fff"/>}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:form.beca?"#7C3AED":"#475569"}}>🎓 Alumno becado</div>
                <div style={{fontSize:11,color:"#94A3B8"}}>No se le generan cobros ni recordatorios</div>
              </div>
            </div>

            {!form.beca&&<div style={{marginBottom:12}}><label style={label}>Monto mensual</label>{form.seccion_id&&<div style={{fontSize:11,color:"#64748B",marginBottom:4}}>Precio del grupo: L {Number(data.secciones.find(s=>s.id===form.seccion_id)?.mensualidad||0).toLocaleString()}</div>}<input type="number" value={form.monto_personalizado} onChange={e=>setForm({...form,monto_personalizado:e.target.value})} placeholder="Dejar vacío = precio del grupo" style={input}/><div style={{fontSize:11,color:"#94A3B8",marginTop:3}}>Llenar solo si tiene descuento o precio especial.</div></div>}
            {form.beca&&<div style={{marginBottom:12,padding:"10px 12px",background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:8,fontSize:12,color:"#5B21B6"}}>Este alumno queda excluido de la generación de cobros por sección y de los recordatorios de pago.</div>}</div><div><h4 style={{fontSize:13,fontWeight:700,color:"#2563EB",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6}}><Users size={15}/>Padre/Encargado</h4><Field label="Nombre *" value={form.padre_nombre} onChange={v=>setForm({...form,padre_nombre:v})}/><Field label="Teléfono" value={form.padre_telefono} onChange={v=>setForm({...form,padre_telefono:v})}/><Field label="Email" value={form.padre_email} onChange={v=>setForm({...form,padre_email:v})} type="email"/></div></div></Modal>}
  </div>);
}

// ── FACTURAS ──
function FacturasPage({data,loadData,showToast}){
  const[tab,setTab]=useState("cobros");const[modal,setModal]=useState(null);const[viewInv,setViewInv]=useState(null);
  const[form,setForm]=useState({alumno_id:"",fecha_pago:"",mes_correspondiente:"",monto_total:"",tipo_pago:"efectivo",notas:"",cobro_id:""});
  const[bulkSec,setBulkSec]=useState("");
  const[imgPreview,setImgPreview]=useState(null);

  const mostrarImagen = (f, tipo="cobro") => {
    const al=data.alumnos.find(a=>a.id===f.alumno_id);
    const padre=al?data.padres.find(p=>p.id===al.padre_id):null;
    const sec=al?data.secciones.find(s=>s.id===al.seccion_id):null;
    const mora=calcMora(f, data.secciones, data.alumnos);
    const dataUrl=generarImgFactura(f,al,padre,sec,mora,tipo);
    setImgPreview({dataUrl,phone:padre?.telefono||"",destinatario:padre?.nombre||al?.nombre||"",numero:f.numero_factura});
  };

  const openComp=(cobro=null)=>{if(cobro){const mora=calcMora(cobro, data.secciones, data.alumnos);setForm({alumno_id:cobro.alumno_id,cobro_id:cobro.id,fecha_pago:new Date().toISOString().split("T")[0],mes_correspondiente:cobro.mes_correspondiente,monto_total:String((Number(cobro.saldo)>0?Number(cobro.saldo):Number(cobro.monto_total)+mora)),tipo_pago:"efectivo",notas:""});}else{setForm({alumno_id:"",fecha_pago:new Date().toISOString().split("T")[0],mes_correspondiente:MESES[new Date().getMonth()],monto_total:"",tipo_pago:"efectivo",notas:"",cobro_id:""});}setModal("comprobante");};

  const crearCobrosSeccion = async () => {
    if(!bulkSec){showToast("Selecciona una sección","error");return;}
    const mes = form.mes_correspondiente || MESES[new Date().getMonth()];
    const sec = data.secciones.find(s=>s.id===bulkSec);
    if(!sec){showToast("Sección no encontrada","error");return;}
    const alumnosSec = data.alumnos.filter(a=>a.seccion_id===bulkSec && a.estado==="activo");
    if(alumnosSec.length===0){showToast("No hay alumnos activos en esta sección","error");return;}
    const yaConCobro = data.facturas.filter(f=>(f.tipo_factura||"cobro")==="cobro"&&f.mes_correspondiente===mes&&f.estado!=="anulada").map(f=>f.alumno_id);
    // Se excluyen los becados y los que ya tienen cobro de ese mes
    const sinCobro = alumnosSec.filter(a=>!yaConCobro.includes(a.id) && a.beca!==true);
    if(sinCobro.length===0){showToast(`No hay cobros nuevos por crear para ${mes}`,"error");return;}
    try{
      let count = data.facturas.length;
      const rows = sinCobro.map(al=>{
        count++;
        const montoAl = (Number(al.monto_personalizado)>0) ? Number(al.monto_personalizado) : Number(sec.mensualidad);
        return {id:uid(),numero_factura:`FC-${String(count).padStart(4,"0")}`,alumno_id:al.id,tipo_factura:"cobro",fecha_emision:new Date().toISOString().split("T")[0],fecha_pago:null,mes_correspondiente:mes,monto_total:montoAl,abono:0,saldo:montoAl,tipo_pago:"efectivo",estado:"pendiente",notas:"",cobro_id:null};
      });
      await db.insertMany("facturas",rows);
      await loadData();
      showToast(`✓ ${rows.length} cobros creados para ${sec.nombre} — ${mes}`);
      setModal(null);
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const saveComp=async()=>{
    if(!form.alumno_id||!form.mes_correspondiente){showToast("Selecciona cobro","error");return;}
    try{
      const total=parseFloat(form.monto_total)||0;
      const num=`CP-${String(data.facturas.length+1).padStart(4,"0")}`;
      const fac={id:uid(),numero_factura:num,alumno_id:form.alumno_id,tipo_factura:"comprobante",fecha_emision:new Date().toISOString().split("T")[0],fecha_pago:form.fecha_pago,mes_correspondiente:form.mes_correspondiente,monto_total:total,abono:0,saldo:0,tipo_pago:form.tipo_pago,estado:"pagada",notas:form.notas,cobro_id:form.cobro_id||null};
      await db.insert("facturas",fac);
      if(form.cobro_id){await db.update("facturas",form.cobro_id,{estado:"pagada",fecha_pago:form.fecha_pago});}
      await loadData();setModal(null);
      setTimeout(()=>mostrarImagen(fac,"comprobante"),300);
      showToast("Pago confirmado ✓ — Comprobante listo para enviar");
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const anular=async(f)=>{try{await db.update("facturas",f.id,{estado:"anulada"});await loadData();showToast("Anulada","error");}catch(e){showToast("Error: "+e.message,"error");}};

  // Cobrar/pagar VARIOS MESES juntos a un alumno.
  // Crea cada mes como su propia factura (cobro + comprobante), marcados pagados.

  const cobros=data.facturas.filter(f=>(f.tipo_factura||"cobro")==="cobro");
  const comps=data.facturas.filter(f=>f.tipo_factura==="comprobante");
  const pendCobros=cobros.filter(f=>f.estado==="pendiente"||f.estado==="parcial");
  const tBtn=(a)=>({padding:"10px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",borderBottom:a?"3px solid #F97316":"3px solid transparent",background:"transparent",color:a?"#F97316":"#64748B"});

  return(<div>
    <div style={{display:"flex",borderBottom:"1px solid #E2E8F0",marginBottom:16}}>
      <button onClick={()=>setTab("cobros")} style={tBtn(tab==="cobros")}>📄 Cobros ({pendCobros.length} pend.)</button>
      <button onClick={()=>setTab("comprobantes")} style={tBtn(tab==="comprobantes")}>✅ Comprobantes ({comps.length})</button>
    </div>

    {tab==="cobros"&&(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:13,color:"#64748B",margin:0}}>{cobros.length} cobros</p>
        <button onClick={()=>{setBulkSec("");setForm({...form,mes_correspondiente:MESES[new Date().getMonth()]});setModal("bulk");}} style={btn("#059669")}><Plus size={15}/>Crear cobros por sección</button>
      </div>
      <div style={card}>{cobros.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay cobros. Crea cobros por sección.</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:750}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["No.","Alumno","Padre","Sección","Mes","Total","Mora","Saldo","Estado",""].map(h=><th key={h} style={{textAlign:["Total","Mora","Saldo"].includes(h)?"right":"left",padding:"5px 4px",color:"#64748B",fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{[...cobros].reverse().map(f=>{const al=data.alumnos.find(a=>a.id===f.alumno_id);const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;const sec=al?data.secciones.find(s=>s.id===al.seccion_id):null;const mora=calcMora(f, data.secciones, data.alumnos);const tot=Number(f.monto_total)+mora;const cols={pagada:"#059669",pendiente:"#DC2626",parcial:"#D97706",anulada:"#64748B"};const isP=f.estado==="pendiente"||f.estado==="parcial";return(
          <tr key={f.id} style={{borderBottom:"1px solid #F1F5F9",background:isP&&mora>0?"#FEF2F2":"transparent"}}>
            <td style={{padding:"5px 4px",fontWeight:600}}>{f.numero_factura}</td>
            <td style={{padding:"5px 4px"}}>{al?.nombre||"—"}</td>
            <td style={{padding:"5px 4px"}}>{p?.nombre||"—"}</td>
            <td style={{padding:"5px 4px"}}>{sec?<span style={badge("#F97316")}>{sec.nombre}</span>:"—"}</td>
            <td style={{padding:"5px 4px"}}>{f.mes_correspondiente}</td>
            <td style={{padding:"5px 4px",textAlign:"right"}}>L {Number(f.monto_total).toLocaleString()}</td>
            <td style={{padding:"5px 4px",textAlign:"right",color:mora>0?"#DC2626":"#94A3B8",fontWeight:mora>0?700:400}}>{mora>0?`L ${mora}`:"—"}</td>
            <td style={{padding:"5px 4px",textAlign:"right",fontWeight:700,color:isP?"#DC2626":"#059669"}}>L {isP?tot.toLocaleString():"0"}</td>
            <td style={{padding:"5px 4px"}}><span style={badge(cols[f.estado]||"#64748B")}>{f.estado}</span></td>
            <td style={{padding:"5px 4px",textAlign:"center",whiteSpace:"nowrap"}}>
              {isP&&<button onClick={()=>mostrarImagen(f,"cobro")} title="Enviar por WhatsApp" style={{background:"#25D366",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:4,marginRight:3}}><Phone size={12} color="#fff"/></button>}
              <button onClick={()=>setViewInv(f)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Eye size={13} color="#2563EB"/></button>
              {isP&&<button onClick={()=>openComp(f)} title="Confirmar pago" style={{background:"#059669",border:"none",cursor:"pointer",padding:"2px 5px",borderRadius:4,marginLeft:2}}><Check size={12} color="#fff"/></button>}
              {isP&&<button onClick={()=>anular(f)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color="#DC2626"/></button>}
            </td>
          </tr>);})}</tbody></table></div>)}</div>
    </div>)}

    {tab==="comprobantes"&&(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><p style={{fontSize:13,color:"#64748B",margin:0}}>{comps.length} comprobantes</p><button onClick={()=>openComp()} style={btn("#2563EB")}><Plus size={15}/>Confirmar pago</button></div>
      <div style={card}>{comps.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay comprobantes</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["No.","Alumno","Mes","Fecha","Total","Tipo","Cobro vinc.",""].map(h=><th key={h} style={{textAlign:h==="Total"?"right":"left",padding:"6px 8px",color:"#64748B",fontWeight:600,fontSize:11}}>{h}</th>)}</tr></thead><tbody>{[...comps].reverse().map(f=>{const al=data.alumnos.find(a=>a.id===f.alumno_id);const cv=f.cobro_id?data.facturas.find(c=>c.id===f.cobro_id):null;return(<tr key={f.id} style={{borderBottom:"1px solid #F1F5F9"}}><td style={{padding:"6px 8px",fontWeight:600}}>{f.numero_factura}</td><td style={{padding:"6px 8px"}}>{al?.nombre||"—"}</td><td style={{padding:"6px 8px"}}>{f.mes_correspondiente}</td><td style={{padding:"6px 8px"}}>{f.fecha_pago||"—"}</td><td style={{padding:"6px 8px",textAlign:"right"}}>L {Number(f.monto_total).toLocaleString()}</td><td style={{padding:"6px 8px"}}>{f.tipo_pago}</td><td style={{padding:"6px 8px"}}>{cv?<span style={badge("#059669")}>✓ {cv.numero_factura}</span>:"—"}</td><td style={{padding:"6px 8px",textAlign:"center"}}><button onClick={()=>mostrarImagen(f,"comprobante")} title="Ver/enviar" style={{background:"#059669",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:4,display:"inline-flex",alignItems:"center",gap:4,color:"#fff",fontSize:11,fontWeight:600}}><Send size={11}/>Enviar</button></td></tr>);})}</tbody></table></div>)}</div>
    </div>)}

    {modal==="bulk"&&<Modal title="📄 Crear cobros por sección" onClose={()=>setModal(null)} onSave={crearCobrosSeccion} wide>
      <div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}>
        <div>
          <div style={{marginBottom:12}}><label style={label}>Sección *</label>
            <select value={bulkSec} onChange={e=>setBulkSec(e.target.value)} style={{...input,cursor:"pointer"}}>
              <option value="">Seleccionar sección</option>
              {data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre} — L {s.mensualidad}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}><label style={label}>Mes a cobrar *</label>
            <select value={form.mes_correspondiente} onChange={e=>setForm({...form,mes_correspondiente:e.target.value})} style={{...input,cursor:"pointer"}}>
              {MESES.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          {bulkSec&&(()=>{
            const sec=data.secciones.find(s=>s.id===bulkSec);
            const als=data.alumnos.filter(a=>a.seccion_id===bulkSec&&a.estado==="activo");
            const becados=als.filter(a=>a.beca===true);
            const mes=form.mes_correspondiente||MESES[new Date().getMonth()];
            const yaTienen=data.facturas.filter(f=>(f.tipo_factura||"cobro")==="cobro"&&f.mes_correspondiente===mes&&f.estado!=="anulada").map(f=>f.alumno_id);
            const nuevos=als.filter(a=>!yaTienen.includes(a.id)&&a.beca!==true);
            return(<div style={{background:"#F0FDF4",borderRadius:8,padding:14,fontSize:12,border:"1px solid #BBF7D0"}}>
              <div style={{fontWeight:700,color:"#166534",marginBottom:8}}>Resumen:</div>
              <div>📚 {sec?.nombre} — L {Number(sec?.mensualidad).toLocaleString()}</div>
              <div>👥 Alumnos activos: {als.length}</div>
              {becados.length>0&&<div style={{color:"#7C3AED",fontWeight:600}}>🎓 Becados (se excluyen): {becados.length}</div>}
              <div>✅ Ya con cobro de {mes}: {als.filter(a=>yaTienen.includes(a.id)).length}</div>
              <div style={{marginTop:8,padding:"8px 10px",background:"#fff",borderRadius:6,fontWeight:700,color:"#059669",fontSize:14}}>📝 Se crearán: {nuevos.length} cobros</div>
              {nuevos.length>0&&<div style={{marginTop:8,fontSize:11,color:"#475569"}}>{nuevos.map(a=>{const m=(Number(a.monto_personalizado)>0)?Number(a.monto_personalizado):Number(sec?.mensualidad);return`${a.nombre} (L ${m.toLocaleString()})`;}).join(", ")}</div>}
              {becados.length>0&&<div style={{marginTop:6,fontSize:11,color:"#7C3AED"}}>Becados: {becados.map(a=>a.nombre).join(", ")}</div>}
            </div>);
          })()}
          {!bulkSec&&<div style={{background:"#F8FAFC",borderRadius:8,padding:20,textAlign:"center",color:"#94A3B8",fontSize:13}}>Selecciona una sección</div>}
        </div>
      </div>
    </Modal>}

    {modal==="comprobante"&&<Modal title="✅ Confirmar pago" onClose={()=>setModal(null)} onSave={saveComp} wide><div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}><div>
      {!form.cobro_id&&<div style={{marginBottom:12}}><label style={label}>Cobro pendiente *</label><select onChange={e=>{const c=pendCobros.find(c=>c.id===e.target.value);if(c)openComp(c);}} style={{...input,cursor:"pointer"}}><option value="">Seleccionar...</option>{pendCobros.map(c=>{const al=data.alumnos.find(a=>a.id===c.alumno_id);return<option key={c.id} value={c.id}>{c.numero_factura} — {al?.nombre} — {c.mes_correspondiente}</option>;})}</select></div>}
      {form.cobro_id&&(()=>{const cobro=data.facturas.find(f=>f.id===form.cobro_id);const al=data.alumnos.find(a=>a.id===form.alumno_id);const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;const mora=cobro?calcMora(cobro, data.secciones, data.alumnos):0;return(<div style={{background:"#F0FDF4",borderRadius:8,padding:12,marginBottom:12,fontSize:12,border:"1px solid #BBF7D0"}}><div style={{fontWeight:700,color:"#166534",marginBottom:4}}>✓ {cobro?.numero_factura}</div><div><strong>Alumno:</strong> {al?.nombre} | <strong>Padre:</strong> {p?.nombre}</div><div><strong>Monto:</strong> L {Number(cobro?.monto_total).toLocaleString()}</div>{mora>0&&<div style={{color:"#DC2626",fontWeight:700}}>⚠️ Mora: L {mora}</div>}</div>);})()}
    </div><div><div style={{marginBottom:12}}><label style={label}>Fecha de pago</label><input type="date" value={form.fecha_pago} onChange={e=>setForm({...form,fecha_pago:e.target.value})} style={input}/></div><Field label="Monto recibido (L)" value={form.monto_total} onChange={v=>setForm({...form,monto_total:v})} type="number"/><div style={{marginBottom:12}}><label style={label}>Tipo de pago</label><select value={form.tipo_pago} onChange={e=>setForm({...form,tipo_pago:e.target.value})} style={{...input,cursor:"pointer"}}>{TIPOS_PAGO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div><Field label="Notas" value={form.notas} onChange={v=>setForm({...form,notas:v})} multiline/></div></div></Modal>}

    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
    {viewInv&&<InvoiceView invoice={viewInv} data={data} onClose={()=>setViewInv(null)} onImagen={mostrarImagen}/>}
  </div>);
}

// ── PREVIEW DE IMAGEN (reutilizable) ──
function ImgPreviewModal({img,onClose}){
  const[estado,setEstado]=useState(null); // null | "copiado" | "error"
  const num = telWA(img.phone);

  // Copia la imagen al portapapeles.
  // Pasar la promesa directo a ClipboardItem conserva el "gesto del usuario",
  // que es lo que exige Chrome para permitir copiar.
  const copiarImagen = async () => {
    try{
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': fetch(img.dataUrl).then(r=>r.blob()) })
      ]);
      setEstado("copiado"); return true;
    }catch(e1){
      try{ // segundo intento con el método clásico
        const blob = await (await fetch(img.dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
        setEstado("copiado"); return true;
      }catch(e2){ setEstado("error"); return false; }
    }
  };

  // Descarga la imagen a la carpeta de Descargas
  const descargar = () => {
    const a=document.createElement('a');
    a.download=`${img.numero}.png`; a.href=img.dataUrl; a.click();
  };

  // Copia + abre el chat del padre en la app de WhatsApp
  const abrirChat = async () => {
    await copiarImagen();
    abrirWhatsApp(img.phone);
  };

  // Menú de compartir del celular (adjunta la imagen directo)
  const compartir = async () => {
    try{
      const blob = await (await fetch(img.dataUrl)).blob();
      const file = new File([blob], `${img.numero}.png`, {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:img.numero});
      }else{
        alert("Este navegador no permite compartir directo. Usa 'Descargar' y adjunta la imagen en WhatsApp.");
      }
    }catch(e){}
  };

  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
    <div style={{background:"#fff",borderRadius:12,padding:16,maxWidth:520,width:"100%",maxHeight:"90vh",overflow:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <h3 style={{fontSize:15,fontWeight:700,color:"#1E293B",margin:0}}>📸 {img.numero}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><X size={20} color="#64748B"/></button>
      </div>

      {/* Destinatario visible para verificar */}
      <div style={{background:num?"#F0FDF4":"#FEF2F2",border:`1px solid ${num?"#BBF7D0":"#FECACA"}`,borderRadius:8,padding:"8px 12px",fontSize:12,marginBottom:10}}>
        {num ? <>Se enviará a: <strong>{img.destinatario||"—"}</strong> · <strong>{telBonito(img.phone)}</strong></>
             : <span style={{color:"#DC2626"}}>⚠️ {img.destinatario||"Este contacto"} no tiene teléfono registrado.</span>}
      </div>

      <img src={img.dataUrl} alt="Factura" style={{width:"100%",borderRadius:8,border:"1px solid #E2E8F0",marginBottom:10}}/>

      {/* Estado de la copia */}
      {estado==="copiado" && <div style={{background:"#ECFDF5",border:"1px solid #059669",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#059669",marginBottom:10,fontWeight:600}}>
        ✓ Imagen copiada. En el chat de WhatsApp pega con <strong>Ctrl+V</strong> y dale Enter.
      </div>}
      {estado==="error" && <div style={{background:"#FFF7ED",border:"1px solid #F97316",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#9A3412",marginBottom:10}}>
        No se pudo copiar automáticamente. Usá <strong>"Descargar"</strong> y luego arrastrá la imagen al chat (o usá el clip 📎 de WhatsApp).
      </div>}

      <div style={{background:"#FEF3C7",borderRadius:8,padding:10,fontSize:12,color:"#92400E",marginBottom:12}}>
        <strong>💻 En computadora:</strong> "Abrir chat" → se abre WhatsApp con el padre y la imagen queda copiada → <strong>Ctrl+V</strong> → Enter.<br/>
        <strong>📱 En celular:</strong> "Compartir imagen" → elegí WhatsApp → elegí el contacto.
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {num && <button onClick={abrirChat} style={btn("#25D366")}><Phone size={14}/>Abrir chat de {img.destinatario?.split(" ")[0]||"WhatsApp"}</button>}
        <button onClick={copiarImagen} style={btn("#0891B2")}><FileText size={14}/>Copiar imagen</button>
        <button onClick={compartir} style={btn("#7C3AED")}><Send size={14}/>Compartir</button>
        <button onClick={descargar} style={btn("#2563EB")}><Download size={14}/>Descargar</button>
        <button onClick={onClose} style={btnO}><X size={14}/>Cerrar</button>
      </div>

      {num && <div style={{fontSize:11,color:"#94A3B8",textAlign:"center"}}>
        ¿No abrió la app? <a href={linkWhatsAppWeb(img.phone)} target="_blank" rel="noreferrer" style={{color:"#2563EB",fontWeight:600}}>Abrir en WhatsApp Web</a>
      </div>}
    </div>
  </div>);
}

// ── VISTA FACTURA ──
function InvoiceView({invoice,data,onClose,onImagen}){
  const f=invoice;const al=data.alumnos.find(a=>a.id===f.alumno_id);const padre=al?data.padres.find(p=>p.id===al.padre_id):null;const sec=al?data.secciones.find(s=>s.id===al.seccion_id):null;const mora=calcMora(f, data.secciones, data.alumnos);
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}><div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto"}}><div style={{padding:24}}>
    <div style={{textAlign:"center",borderBottom:"2px solid #F97316",paddingBottom:16,marginBottom:16}}><div style={{fontSize:28}}>🌱</div><h2 style={{fontSize:18,fontWeight:800,color:"#1E293B",margin:"4px 0"}}>Seeds English School</h2><p style={{fontSize:11,color:"#64748B",margin:0}}>Jesús de Otoro, Intibucá</p><p style={{fontSize:13,fontWeight:700,color:"#F97316",margin:"8px 0 0"}}>{f.tipo_factura==="comprobante"?"COMPROBANTE":"FACTURA"} {f.numero_factura}</p></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13,marginBottom:16}}><div><div style={{fontWeight:700,color:"#475569",marginBottom:6}}>Alumno</div><div><strong>Nombre:</strong> {al?.nombre||"—"}</div><div><strong>Padre:</strong> {padre?.nombre||"—"}</div><div><strong>Tel:</strong> {padre?.telefono||"—"}</div><div><strong>Sección:</strong> {sec?.nombre||"—"}</div></div><div><div style={{fontWeight:700,color:"#475569",marginBottom:6}}>Pago</div><div><strong>Emisión:</strong> {f.fecha_emision}</div><div><strong>Pago:</strong> {f.fecha_pago||"—"}</div><div><strong>Mes:</strong> {f.mes_correspondiente}</div><div><strong>Tipo:</strong> {f.tipo_pago}</div></div></div>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:16}}><thead><tr style={{background:"#F8FAFC"}}><th style={{textAlign:"left",padding:"8px 12px",border:"1px solid #E2E8F0"}}>Concepto</th><th style={{textAlign:"right",padding:"8px 12px",border:"1px solid #E2E8F0"}}>Monto</th></tr></thead><tbody><tr><td style={{padding:"8px 12px",border:"1px solid #E2E8F0"}}>Mensualidad {f.mes_correspondiente}</td><td style={{padding:"8px 12px",border:"1px solid #E2E8F0",textAlign:"right"}}>L {Number(f.monto_total).toLocaleString()}</td></tr>{mora>0&&<tr><td style={{padding:"8px 12px",border:"1px solid #E2E8F0",color:"#DC2626"}}>Mora</td><td style={{padding:"8px 12px",border:"1px solid #E2E8F0",textAlign:"right",color:"#DC2626"}}>L {mora.toLocaleString()}</td></tr>}</tbody></table>
    <div style={{textAlign:"right",fontSize:16,fontWeight:800,color:"#1E293B"}}>TOTAL: L {(Number(f.monto_total)+mora).toLocaleString()}</div>
  </div>
  <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"0 24px 20px",flexWrap:"wrap"}}>
    <button onClick={onClose} style={btnO}><X size={14}/>Cerrar</button>
    <button onClick={()=>onImagen(f,f.tipo_factura==="comprobante"?"comprobante":"cobro")} style={btn("#25D366")}><Send size={14}/>{f.tipo_factura==="comprobante"?"Enviar comprobante":"Enviar cobro"}</button>
  </div></div></div>);
}

// ── HISTORIAL ──
function HistorialPage({data,loadData,showToast}){
  const[selSec,setSelSec]=useState("");const[selAl,setSelAl]=useState("");
  const[imgPreview,setImgPreview]=useState(null);
  const[pagoModal,setPagoModal]=useState(null); // {mes, cobroExistente}
  const[pagoForm,setPagoForm]=useState({fecha_pago:new Date().toISOString().split("T")[0],tipo_pago:"efectivo"});
  const als=data.alumnos.filter(a=>!selSec||a.seccion_id===selSec);
  const alumno=selAl?data.alumnos.find(a=>a.id===selAl):null;
  const padre=alumno?data.padres.find(p=>p.id===alumno.padre_id):null;
  const sec=alumno?data.secciones.find(s=>s.id===alumno.seccion_id):null;

  const verImagen = (f, tipo) => {
    const al=data.alumnos.find(a=>a.id===f.alumno_id);
    const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;
    const s=al?data.secciones.find(ss=>ss.id===al.seccion_id):null;
    const mora=calcMora(f, data.secciones, data.alumnos);
    const dataUrl=generarImgFactura(f,al,p,s,mora,tipo);
    setImgPreview({dataUrl,phone:p?.telefono||"",destinatario:p?.nombre||al?.nombre||"",numero:f.numero_factura});
  };

  // Abrir modal para marcar un mes como pagado desde el historial
  const abrirPago=(mes,cobroExistente)=>{
    setPagoForm({fecha_pago:new Date().toISOString().split("T")[0],tipo_pago:cobroExistente?.tipo_pago||"efectivo"});
    setPagoModal({mes,cobroExistente});
  };

  // Marcar pagado: crea el cobro si no existe, y el comprobante, todo en un paso
  const marcarPagado=async()=>{
    if(!alumno){return;}
    const {mes,cobroExistente}=pagoModal;
    try{
      const monto=(Number(alumno.monto_personalizado)>0)?Number(alumno.monto_personalizado):Number(sec?.mensualidad)||0;
      let n=data.facturas.length;
      let cobroId;
      const nuevas=[];
      if(cobroExistente){
        cobroId=cobroExistente.id;
      }else{
        // crear el cobro (ya pagado)
        n++; cobroId=uid();
        nuevas.push({id:cobroId,numero_factura:`FC-${String(n).padStart(4,"0")}`,alumno_id:alumno.id,tipo_factura:"cobro",fecha_emision:new Date().toISOString().split("T")[0],fecha_pago:pagoForm.fecha_pago,mes_correspondiente:mes,monto_total:monto,abono:0,saldo:0,tipo_pago:pagoForm.tipo_pago,estado:"pagada",notas:"",cobro_id:null});
      }
      // crear el comprobante
      n++;
      const comp={id:uid(),numero_factura:`CP-${String(n).padStart(4,"0")}`,alumno_id:alumno.id,tipo_factura:"comprobante",fecha_emision:new Date().toISOString().split("T")[0],fecha_pago:pagoForm.fecha_pago,mes_correspondiente:mes,monto_total:monto,abono:0,saldo:0,tipo_pago:pagoForm.tipo_pago,estado:"pagada",notas:"",cobro_id:cobroId};
      nuevas.push(comp);
      await db.insertMany("facturas",nuevas);
      if(cobroExistente&&cobroExistente.estado!=="pagada"){await db.update("facturas",cobroExistente.id,{estado:"pagada",fecha_pago:pagoForm.fecha_pago});}
      await loadData();setPagoModal(null);
      setTimeout(()=>verImagen(comp,"comprobante"),300);
      showToast(`✓ ${mes} pagado — comprobante listo`);
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const tablaMensual = selAl ? MESES.map(mes => {
    const cobro = data.facturas.find(f=>f.alumno_id===selAl&&f.mes_correspondiente===mes&&(f.tipo_factura||"cobro")==="cobro"&&f.estado!=="anulada");
    const comp = data.facturas.find(f=>f.alumno_id===selAl&&f.mes_correspondiente===mes&&f.tipo_factura==="comprobante");
    return { mes, cobro, comp };
  }) : [];

  const monto = alumno ? ((Number(alumno.monto_personalizado)>0)?Number(alumno.monto_personalizado):Number(sec?.mensualidad)||0) : 0;

  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <select value={selSec} onChange={e=>{setSelSec(e.target.value);setSelAl("");}} style={{...input,width:200,cursor:"pointer"}}>
        <option value="">Todas las secciones</option>
        {data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <select value={selAl} onChange={e=>setSelAl(e.target.value)} style={{...input,width:250,cursor:"pointer"}}>
        <option value="">Seleccionar alumno</option>
        {als.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
    </div>
    {alumno&&<div style={{...card,borderLeft:"4px solid #F97316"}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:"#1E293B",margin:"0 0 4px"}}>{alumno.nombre}</h3>
          <div style={{fontSize:13,color:"#64748B"}}>Padre: <strong>{padre?.nombre||"—"}</strong> · Tel: {padre?.telefono||"—"} · Sección: <strong>{sec?.nombre||"—"}</strong></div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:12,color:"#64748B"}}>Mensualidad</div>
          {alumno.beca
            ? <div style={{fontSize:18,fontWeight:800,color:"#7C3AED"}}>🎓 Becado</div>
            : <><div style={{fontSize:20,fontWeight:800,color:"#F97316"}}>L {monto.toLocaleString()}</div>
                {Number(alumno.monto_personalizado)>0&&<div style={{fontSize:11,color:"#7C3AED"}}>Precio especial ✎</div>}</>}
        </div>
      </div>
    </div>}
    {selAl&&<div style={card}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 14px",display:"flex",alignItems:"center",gap:6}}><Calendar size={16}/>Control de pagos — {new Date().getFullYear()}</h3>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>
            <th style={{textAlign:"left",padding:"8px 10px",color:"#64748B",fontWeight:700,width:80}}>Mes</th>
            <th style={{textAlign:"left",padding:"8px 10px",color:"#2563EB",fontWeight:700}}>📄 Cobro</th>
            <th style={{textAlign:"left",padding:"8px 10px",color:"#059669",fontWeight:700}}>✅ Comprobante</th>
          </tr></thead>
          <tbody>
            {tablaMensual.map(({mes,cobro,comp})=>{
              const esFuturo=MESES.indexOf(mes)>new Date().getMonth();
              return(<tr key={mes} style={{borderBottom:"1px solid #F1F5F9",background:esFuturo?"#FAFAFF":"transparent"}}>
                <td style={{padding:"8px 10px",fontWeight:700,color:esFuturo?"#7C3AED":"#1E293B"}}>{mes.slice(0,3)}{esFuturo?<span style={{fontSize:9,fontWeight:600,color:"#A78BFA",display:"block"}}>adelantado</span>:""}</td>
                <td style={{padding:"8px 10px"}}>
                  {cobro?(<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={badge(cobro.estado==="pagada"?"#059669":cobro.estado==="pendiente"?"#DC2626":"#D97706")}>{cobro.numero_factura} · {cobro.estado}</span>
                    <span style={{fontSize:11,color:"#475569"}}>L {Number(cobro.monto_total).toLocaleString()}</span>
                    <button onClick={()=>verImagen(cobro,"cobro")} style={{background:"#2563EB",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4}}><Send size={10} color="#fff"/></button>
                  </div>):(<span style={{color:"#94A3B8",fontSize:11}}>Sin cobro</span>)}
                </td>
                <td style={{padding:"8px 10px"}}>
                  {comp?(<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={badge("#059669")}>{comp.numero_factura} · ✓ Pagado</span>
                    <span style={{fontSize:11,color:"#475569"}}>{comp.fecha_pago} · {comp.tipo_pago}</span>
                    <button onClick={()=>verImagen(comp,"comprobante")} style={{background:"#059669",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4}}><Send size={10} color="#fff"/></button>
                  </div>):(
                    <button onClick={()=>abrirPago(mes,cobro)} style={{background:esFuturo?"#7C3AED":"#059669",border:"none",cursor:"pointer",padding:"4px 10px",borderRadius:5,color:"#fff",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}><Check size={12}/>Marcar pagado</button>
                  )}
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:14,display:"flex",gap:12,flexWrap:"wrap",fontSize:12}}>
        <span style={badge("#059669")}>✓ Pagados: {tablaMensual.filter(t=>t.cobro?.estado==="pagada").length}</span>
        <span style={badge("#DC2626")}>⏳ Pendientes: {tablaMensual.filter(t=>t.cobro&&t.cobro.estado==="pendiente").length}</span>
      </div>
    </div>}
    {!selAl&&<div style={card}><h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 8px"}}>Selecciona un alumno</h3><p style={{fontSize:13,color:"#94A3B8"}}>Filtra por sección y selecciona el alumno para ver su tabla de cobros y comprobantes mes por mes. Puedes marcar cualquier mes como pagado con un solo clic.</p></div>}

    {/* Modal marcar pagado desde historial */}
    {pagoModal&&alumno&&<Modal title={`✅ Registrar pago — ${pagoModal.mes}`} onClose={()=>setPagoModal(null)} onSave={marcarPagado}>
      <div style={{background:"#F0FDF4",borderRadius:8,padding:12,marginBottom:14,fontSize:13,border:"1px solid #BBF7D0"}}>
        <div><strong>Alumno:</strong> {alumno.nombre}</div>
        <div><strong>Mes:</strong> {pagoModal.mes}</div>
        <div><strong>Monto:</strong> L {monto.toLocaleString()}</div>
        {pagoModal.cobroExistente
          ? <div style={{color:"#059669",fontSize:12,marginTop:4}}>Ya tenía cobro creado ({pagoModal.cobroExistente.numero_factura}). Se marcará pagado.</div>
          : <div style={{color:"#6D28D9",fontSize:12,marginTop:4}}>Se creará el cobro y el comprobante en un solo paso.</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={label}>Fecha de pago</label><input type="date" value={pagoForm.fecha_pago} onChange={e=>setPagoForm({...pagoForm,fecha_pago:e.target.value})} style={input}/></div>
        <div><label style={label}>Tipo de pago</label><select value={pagoForm.tipo_pago} onChange={e=>setPagoForm({...pagoForm,tipo_pago:e.target.value})} style={{...input,cursor:"pointer"}}>{TIPOS_PAGO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      </div>
    </Modal>}

    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
  </div>);
}

// ── RECORDATORIOS ──
function RecordatoriosPage({data,showToast}){
  const[selSec,setSelSec]=useState("");const[enviando,setEnviando]=useState(false);const[enviados,setEnviados]=useState([]);
  const[mensaje,setMensaje]=useState("Estimado padre de familia, le recordamos que la mensualidad de {mes} está pendiente (L {monto}). Favor enviar comprobante de pago. Seeds English School 🌱");
  const mes=MESES[new Date().getMonth()];
  const contactos=(selSec?data.alumnos.filter(a=>a.seccion_id===selSec&&a.estado==="activo"):data.alumnos.filter(a=>a.estado==="activo")).filter(al=>al.beca!==true).filter(al=>!data.facturas.some(f=>f.alumno_id===al.id&&f.mes_correspondiente===mes&&f.estado==="pagada"&&(f.tipo_factura||"cobro")==="cobro")).map(al=>{const p=data.padres.find(p=>p.id===al.padre_id);const sec=data.secciones.find(s=>s.id===al.seccion_id);const cobro=data.facturas.find(f=>f.alumno_id===al.id&&f.mes_correspondiente===mes&&(f.tipo_factura||"cobro")==="cobro");const mora=cobro?calcMora(cobro, data.secciones, data.alumnos):0;const base=(Number(al.monto_personalizado)>0)?Number(al.monto_personalizado):Number(sec?.mensualidad)||0;return{alumno_id:al.id,alumno:al.nombre,padre:p?.nombre,telefono:p?.telefono,email:p?.email,seccion:sec?.nombre,monto:base+mora,mora};});
  const envUno=(c)=>{if(!c.telefono){showToast(`${c.alumno}: Sin teléfono`,"error");return;}const msg=mensaje.replace("{mes}",mes).replace("{monto}",c.monto.toLocaleString());abrirWhatsApp(c.telefono,msg);setEnviados(p=>[...p,c.alumno_id]);showToast(`Chat abierto: ${c.padre||c.alumno}`);};
  const envTodos=()=>{const ct=contactos.filter(c=>c.telefono&&!enviados.includes(c.alumno_id));if(!ct.length){showToast("Sin pendientes","error");return;}setEnviando(true);let i=0;const iv=setInterval(()=>{if(i>=ct.length){clearInterval(iv);setEnviando(false);showToast(`✓ ${ct.length} enviados`);return;}envUno(ct[i]);i++;},2500);};
  const envEmail=()=>{const ct=contactos.filter(c=>c.email&&!enviados.includes(c.alumno_id));if(!ct.length){showToast("Sin correos","error");return;}const msg=mensaje.replace("{mes}",mes).replace("{monto}","su monto");window.open(`mailto:${ct.map(c=>c.email).join(",")}?subject=${encodeURIComponent("Recordatorio - Seeds")}&body=${encodeURIComponent(msg)}`,"_blank");setEnviados(p=>[...p,...ct.map(c=>c.alumno_id)]);showToast(`Correo con ${ct.length} destinatarios`);};
  return(<div>
    <div style={card}><h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 14px",display:"flex",alignItems:"center",gap:6}}><Bell size={16} color="#7C3AED"/>Recordatorios — {mes}</h3>
      <div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16,marginBottom:16}}><div><label style={label}>Sección</label><select value={selSec} onChange={e=>{setSelSec(e.target.value);setEnviados([]);}} style={{...input,cursor:"pointer"}}><option value="">Todas</option>{data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div><div><label style={label}>Resumen</label><div style={{display:"flex",gap:10,fontSize:13}}><span style={badge("#DC2626")}>{contactos.length} pendientes</span><span style={badge("#059669")}>{enviados.length} enviados</span></div></div></div>
      <div style={{marginBottom:16}}><label style={label}>Mensaje ({"{mes}"} y {"{monto}"})</label><textarea value={mensaje} onChange={e=>setMensaje(e.target.value)} rows={3} style={{...input,resize:"vertical"}}/></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={envTodos} disabled={enviando} style={{...btn("#25D366"),opacity:enviando?0.6:1}}><Phone size={15}/>{enviando?"Enviando...":`WhatsApp a todos (${contactos.filter(c=>c.telefono).length})`}</button><button onClick={envEmail} style={btn("#2563EB")}><Mail size={15}/>Email a todos ({contactos.filter(c=>c.email).length})</button></div>
    </div>
    <div style={card}><h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 14px"}}>Pendientes ({contactos.length})</h3>
      {contactos.length===0?<p style={{fontSize:13,color:"#059669",padding:20,textAlign:"center"}}>✓ Todos al día</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["Alumno","Padre","Tel.","Sección","Monto","Mora","Enviar"].map(h=><th key={h} style={{textAlign:h==="Enviar"?"center":h==="Monto"||h==="Mora"?"right":"left",padding:"6px 8px",color:"#64748B",fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>{contactos.map((c,i)=>{const done=enviados.includes(c.alumno_id);return(<tr key={i} style={{borderBottom:"1px solid #F1F5F9",background:done?"#F0FDF4":"transparent"}}><td style={{padding:"6px 8px",fontWeight:600}}>{c.alumno}</td><td style={{padding:"6px 8px"}}>{c.padre||"—"}</td><td style={{padding:"6px 8px"}}>{c.telefono?telBonito(c.telefono):<span style={{color:"#DC2626"}}>Sin tel.</span>}</td><td style={{padding:"6px 8px"}}>{c.seccion?<span style={badge("#F97316")}>{c.seccion}</span>:"—"}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600}}>L {c.monto.toLocaleString()}</td><td style={{padding:"6px 8px",textAlign:"right",color:c.mora>0?"#DC2626":"#94A3B8"}}>{c.mora>0?`L ${c.mora}`:"—"}</td>
          <td style={{padding:"6px 8px",textAlign:"center"}}>{done?<span style={badge("#059669")}>✓</span>:c.telefono?<button onClick={()=>envUno(c)} style={{background:"#25D366",border:"none",cursor:"pointer",padding:"4px 7px",borderRadius:4}}><Phone size={12} color="#fff"/></button>:<span style={{fontSize:11,color:"#DC2626"}}>Sin tel.</span>}</td></tr>);})}</tbody></table></div>)}
    </div>
  </div>);
}

// ── FINANZAS ──
function FinanzasPage({data,loadData,showToast}){
  const[tab,setTab]=useState("resumen");const[modal,setModal]=useState(null);
  const[imgPreview,setImgPreview]=useState(null);
  const[form,setForm]=useState({tipo:"salario",maestro_id:"",descripcion:"",monto:"",fecha:new Date().toISOString().split("T")[0],mes_correspondiente:MESES[new Date().getMonth()]});
  const mesActual=MESES[new Date().getMonth()];

  const openGasto=(tipo="salario")=>{setForm({tipo,maestro_id:"",descripcion:tipo==="renta"?"Renta del local":"",monto:"",fecha:new Date().toISOString().split("T")[0],mes_correspondiente:mesActual});setModal("gasto");};
  const selMaestro=(mid)=>{const m=data.maestros.find(x=>x.id===mid);setForm({...form,maestro_id:mid,monto:String(m?.salario||""),descripcion:`Salario ${m?.nombre||""}`});};

  const saveGasto=async()=>{
    if(!form.monto||parseFloat(form.monto)<=0){showToast("Ingresa el monto","error");return;}
    if(form.tipo==="salario"&&!form.maestro_id){showToast("Selecciona un maestro","error");return;}
    try{
      const gasto={id:uid(),tipo:form.tipo,maestro_id:form.maestro_id||null,descripcion:form.descripcion,monto:parseFloat(form.monto),fecha:form.fecha,mes_correspondiente:form.mes_correspondiente};
      await db.insert("gastos",gasto);
      await loadData();setModal(null);
      if(form.tipo==="salario"){
        const m=data.maestros.find(x=>x.id===form.maestro_id);
        setTimeout(()=>mostrarPagoImg(gasto,m),300);
        showToast(`✓ Pago a ${m?.nombre} registrado`);
      }else{showToast(`✓ Gasto registrado`);}
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const mostrarPagoImg = (gasto,maestro) => {
    const cv=document.createElement('canvas');cv.width=600;cv.height=500;
    const c=cv.getContext('2d');
    c.fillStyle='#fff';c.fillRect(0,0,600,500);
    c.fillStyle='#059669';c.fillRect(0,0,600,80);
    c.fillStyle='#fff';c.font='bold 22px Segoe UI,sans-serif';c.textAlign='center';c.fillText('Seeds English School',300,35);
    c.fillStyle='#D1FAE5';c.font='12px Segoe UI,sans-serif';c.fillText('Jesús de Otoro, Intibucá, Honduras',300,55);
    c.fillStyle='#059669';c.fillRect(0,80,600,4);
    c.fillStyle='#059669';c.font='bold 18px Segoe UI,sans-serif';c.fillText('COMPROBANTE DE PAGO',300,115);
    c.fillStyle='#1E293B';c.font='bold 14px Segoe UI,sans-serif';c.fillText(`${gasto.mes_correspondiente} — ${gasto.fecha}`,300,138);
    c.strokeStyle='#E2E8F0';c.beginPath();c.moveTo(40,155);c.lineTo(560,155);c.stroke();
    c.textAlign='left';c.fillStyle='#059669';c.font='bold 12px Segoe UI,sans-serif';c.fillText('DATOS DEL MAESTRO',50,180);
    c.fillStyle='#1E293B';c.font='14px Segoe UI,sans-serif';
    c.fillText(`Nombre: ${maestro?.nombre||'—'}`,50,205);
    c.fillText(`Teléfono: ${maestro?.telefono||'—'}`,50,228);
    const secs=(maestro?.secciones_ids||[]).map(sid=>data.secciones.find(s=>s.id===sid)?.nombre).filter(Boolean).join(", ");
    c.fillText(`Secciones: ${secs||'—'}`,50,251);
    c.beginPath();c.moveTo(40,275);c.lineTo(560,275);c.stroke();
    c.fillStyle='#F1F5F9';c.fillRect(40,285,520,35);
    c.fillStyle='#475569';c.font='bold 12px Segoe UI,sans-serif';c.fillText('Concepto',55,307);
    c.textAlign='right';c.fillText('Monto',545,307);
    c.textAlign='left';c.fillStyle='#1E293B';c.font='14px Segoe UI,sans-serif';
    c.fillText(gasto.descripcion||`Salario ${gasto.mes_correspondiente}`,55,342);
    c.textAlign='right';c.fillText(`L ${Number(gasto.monto).toLocaleString()}`,545,342);
    c.fillStyle='#059669';c.fillRect(40,365,520,45);
    c.fillStyle='#fff';c.font='bold 20px Segoe UI,sans-serif';c.textAlign='left';c.fillText('TOTAL PAGADO:',60,394);
    c.textAlign='right';c.fillText(`L ${Number(gasto.monto).toLocaleString()}`,540,394);
    c.save();c.translate(300,455);c.rotate(-0.1);c.strokeStyle='#059669';c.lineWidth=3;c.font='bold 36px Segoe UI,sans-serif';c.textAlign='center';c.strokeText('✓ PAGADO',0,0);c.restore();
    c.strokeStyle='#E2E8F0';c.lineWidth=2;c.strokeRect(1,1,598,498);
    const dataUrl=cv.toDataURL('image/png');
    setImgPreview({dataUrl,phone:maestro?.telefono||"",destinatario:maestro?.nombre||"",numero:`Pago ${gasto.mes_correspondiente}`});
  };

  const eliminarGasto=async(id)=>{if(!confirm("¿Eliminar gasto?"))return;try{await db.remove("gastos",id);await loadData();showToast("Eliminado","error");}catch(e){showToast("Error: "+e.message,"error");}};

  const ingresosMes=(mes)=>data.facturas.filter(f=>f.tipo_factura==="comprobante"&&f.mes_correspondiente===mes).reduce((s,f)=>s+(Number(f.monto_total)||0),0);
  const gastosMes=(mes)=>data.gastos.filter(g=>g.mes_correspondiente===mes).reduce((s,g)=>s+(Number(g.monto)||0),0);
  const salariosMes=(mes)=>data.gastos.filter(g=>g.tipo==="salario"&&g.mes_correspondiente===mes).reduce((s,g)=>s+(Number(g.monto)||0),0);
  const rentaMes=(mes)=>data.gastos.filter(g=>g.tipo==="renta"&&g.mes_correspondiente===mes).reduce((s,g)=>s+(Number(g.monto)||0),0);
  const tBtn=(a)=>({padding:"10px 18px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",borderBottom:a?"3px solid #F97316":"3px solid transparent",background:"transparent",color:a?"#F97316":"#64748B"});

  return(<div>
    <div style={{display:"flex",borderBottom:"1px solid #E2E8F0",marginBottom:16,flexWrap:"wrap"}}>
      <button onClick={()=>setTab("resumen")} style={tBtn(tab==="resumen")}>📊 Resumen</button>
      <button onClick={()=>setTab("maestros")} style={tBtn(tab==="maestros")}>👩‍🏫 Pagos a maestros</button>
      <button onClick={()=>setTab("gastos")} style={tBtn(tab==="gastos")}>📋 Todos los gastos</button>
    </div>

    {tab==="resumen"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
      {MESES.slice(0,new Date().getMonth()+1).reverse().map(mes=>{
        const ing=ingresosMes(mes);const gas=gastosMes(mes);const net=ing-gas;
        return(<div key={mes} style={{...card,borderLeft:`4px solid ${net>=0?"#059669":"#DC2626"}`}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1E293B",marginBottom:8}}>{mes}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
            <div><span style={{color:"#64748B"}}>Ingresos:</span> <strong style={{color:"#059669"}}>L {ing.toLocaleString()}</strong></div>
            <div><span style={{color:"#64748B"}}>Gastos:</span> <strong style={{color:"#DC2626"}}>L {gas.toLocaleString()}</strong></div>
            <div><span style={{color:"#64748B"}}>Salarios:</span> L {salariosMes(mes).toLocaleString()}</div>
            <div><span style={{color:"#64748B"}}>Renta:</span> L {rentaMes(mes).toLocaleString()}</div>
          </div>
          <div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:net>=0?"#ECFDF5":"#FEF2F2",fontWeight:700,fontSize:14,color:net>=0?"#059669":"#DC2626",textAlign:"right"}}>{net>=0?"Ganancia":"Pérdida"}: L {Math.abs(net).toLocaleString()}</div>
        </div>);
      })}
    </div>}

    {tab==="maestros"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:13,color:"#64748B",margin:0}}>Pagos: {data.gastos.filter(g=>g.tipo==="salario").length}</p>
        <button onClick={()=>openGasto("salario")} style={btn("#059669")}><Plus size={15}/>Pagar maestro</button>
      </div>
      {data.maestros.map(m=>{
        const pagos=data.gastos.filter(g=>g.tipo==="salario"&&g.maestro_id===m.id);
        const mesesPag=pagos.map(p=>p.mes_correspondiente);
        return(<div key={m.id} style={{...card,borderLeft:"4px solid #2563EB"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div><h4 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:0}}>{m.nombre}</h4><div style={{fontSize:12,color:"#64748B"}}>{m.telefono||""} · Salario: <strong style={{color:"#059669"}}>L {Number(m.salario||0).toLocaleString()}</strong></div></div>
            <button onClick={()=>{setForm({tipo:"salario",maestro_id:m.id,descripcion:`Salario ${m.nombre}`,monto:String(m.salario||""),fecha:new Date().toISOString().split("T")[0],mes_correspondiente:mesActual});setModal("gasto");}} style={btn("#059669")}><DollarSign size={13}/>Pagar</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:6}}>
            {MESES.map(mes=>{const pagado=mesesPag.includes(mes);const pago=pagos.find(p=>p.mes_correspondiente===mes);return(
              <div key={mes} onClick={()=>{if(pagado&&pago)mostrarPagoImg(pago,m);}} style={{padding:6,borderRadius:6,textAlign:"center",background:pagado?"#ECFDF5":"#F8FAFC",border:`1px solid ${pagado?"#059669":"#E2E8F0"}`,cursor:pagado?"pointer":"default"}}>
                <div style={{fontSize:10,fontWeight:700,color:pagado?"#059669":"#94A3B8"}}>{mes.slice(0,3)}</div>
                <div style={{fontSize:14}}>{pagado?"✓":"—"}</div>
              </div>);})}
          </div>
        </div>);
      })}
      {data.maestros.length===0&&<div style={card}><p style={{fontSize:13,color:"#94A3B8",textAlign:"center"}}>Registra maestros primero (con su salario)</p></div>}
    </div>}

    {tab==="gastos"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:13,color:"#64748B",margin:0}}>{data.gastos.length} gastos</p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>openGasto("renta")} style={btn("#7C3AED")}><Plus size={15}/>Renta</button>
          <button onClick={()=>openGasto("otro")} style={btn("#64748B")}><Plus size={15}/>Otro gasto</button>
        </div>
      </div>
      <div style={card}>{data.gastos.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay gastos</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["Fecha","Tipo","Descripción","Mes","Monto",""].map(h=><th key={h} style={{textAlign:h==="Monto"?"right":"left",padding:"6px 8px",color:"#64748B",fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{[...data.gastos].reverse().map(g=>{const tc={salario:"#059669",renta:"#7C3AED",otro:"#64748B"};const tl={salario:"Salario",renta:"Renta",otro:"Otro"};return(<tr key={g.id} style={{borderBottom:"1px solid #F1F5F9"}}><td style={{padding:"6px 8px"}}>{g.fecha}</td><td style={{padding:"6px 8px"}}><span style={badge(tc[g.tipo]||"#64748B")}>{tl[g.tipo]||g.tipo}</span></td><td style={{padding:"6px 8px"}}>{g.descripcion}</td><td style={{padding:"6px 8px"}}>{g.mes_correspondiente}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:"#DC2626"}}>L {Number(g.monto).toLocaleString()}</td><td style={{padding:"6px 8px"}}><button onClick={()=>eliminarGasto(g.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Trash2 size={13} color="#EF4444"/></button></td></tr>);})}</tbody></table></div>)}</div>
    </div>}

    {modal==="gasto"&&<Modal title={form.tipo==="salario"?"💰 Pagar maestro":form.tipo==="renta"?"🏠 Registrar renta":"📋 Registrar gasto"} onClose={()=>setModal(null)} onSave={saveGasto}>
      {form.tipo==="salario"&&<div style={{marginBottom:12}}><label style={label}>Maestro *</label><select value={form.maestro_id} onChange={e=>selMaestro(e.target.value)} style={{...input,cursor:"pointer"}}><option value="">Seleccionar</option>{data.maestros.map(m=><option key={m.id} value={m.id}>{m.nombre} — L {Number(m.salario||0).toLocaleString()}</option>)}</select></div>}
      {form.maestro_id&&form.tipo==="salario"&&(()=>{const m=data.maestros.find(x=>x.id===form.maestro_id);const pagos=data.gastos.filter(g=>g.tipo==="salario"&&g.maestro_id===m?.id).map(g=>g.mes_correspondiente);return(<div style={{background:"#F0FDF4",borderRadius:8,padding:10,marginBottom:12,fontSize:12,border:"1px solid #BBF7D0"}}><strong>{m?.nombre}</strong> — L {Number(m?.salario).toLocaleString()}<br/>Meses pagados: {pagos.length>0?pagos.join(", "):"Ninguno"}</div>);})()}
      <Field label="Descripción" value={form.descripcion} onChange={v=>setForm({...form,descripcion:v})}/>
      <Field label="Monto (L)" value={form.monto} onChange={v=>setForm({...form,monto:v})} type="number"/>
      <div style={{marginBottom:12}}><label style={label}>Mes</label><select value={form.mes_correspondiente} onChange={e=>setForm({...form,mes_correspondiente:e.target.value})} style={{...input,cursor:"pointer"}}>{MESES.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
      <div style={{marginBottom:12}}><label style={label}>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={input}/></div>
    </Modal>}

    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
  </div>);
}

// ── SISTEMA (usuarios, respaldos) ──
function SistemaPage({data,loadData,showToast,session}){
  const exportar=()=>{
    const backup={fecha:new Date().toISOString(),version:3,...data};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
    const a=document.createElement('a');
    a.download=`seeds_respaldo_${new Date().toISOString().split("T")[0]}.json`;
    a.href=URL.createObjectURL(blob);a.click();
    showToast("✓ Respaldo descargado");
  };
  const importar=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    if(!confirm("Esto restaurará los datos del respaldo (se combinan con los actuales). ¿Continuar?"))return;
    try{
      const text=await file.text();const backup=JSON.parse(text);
      for(const table of ["secciones","maestros","padres","alumnos","facturas","gastos","materiales","ventas_material"]){
        if(backup[table]?.length) await db.upsertMany(table,backup[table]);
      }
      await loadData();showToast("✓ Respaldo restaurado");
    }catch(err){showToast("Error al restaurar: "+err.message,"error");}
    e.target.value="";
  };
  return(<div>
    <div style={card}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 10px"}}>👤 Tu cuenta</h3>
      <p style={{fontSize:13,color:"#475569"}}>Sesión activa: <strong>{session.user.email}</strong></p>
      <div style={{background:"#EFF6FF",borderRadius:8,padding:12,fontSize:12,color:"#1E40AF",marginTop:10}}>
        <strong>¿Cómo agregar más usuarios (secretaria, maestros)?</strong><br/>
        1. Entra a tu proyecto en <strong>supabase.com</strong><br/>
        2. Menú lateral → <strong>Authentication</strong> → <strong>Users</strong> → <strong>Add user</strong> → "Create new user"<br/>
        3. Pon su correo y contraseña → listo, ya puede entrar a la app
      </div>
    </div>
    <div style={card}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 10px"}}>💾 Respaldos</h3>
      <p style={{fontSize:13,color:"#475569",marginBottom:12}}>Tus datos viven seguros en Supabase (nube). Aun así, descarga un respaldo cada mes como protección extra.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={exportar} style={btn("#059669")}><Download size={15}/>Descargar respaldo</button>
        <label style={{...btn("#2563EB"),cursor:"pointer"}}><Upload size={15}/>Restaurar respaldo<input type="file" accept=".json" onChange={importar} style={{display:"none"}}/></label>
      </div>
      <div style={{background:"#FEF3C7",borderRadius:8,padding:12,fontSize:12,color:"#92400E",marginTop:14}}>
        ⚠️ <strong>Importante (plan gratuito de Supabase):</strong> si nadie entra a la app durante 7 días seguidos, Supabase "pausa" el proyecto (los datos NO se borran, solo se pausa). Para reactivarlo: entra a supabase.com → tu proyecto → botón "Restore". Con uso diario de la escuela esto no pasa; solo pendiente en vacaciones largas.
      </div>
    </div>
    <div style={card}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 10px"}}>📊 Datos actuales</h3>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12}}>
        <span style={badge("#2563EB")}>{data.alumnos.length} alumnos</span>
        <span style={badge("#F97316")}>{data.secciones.length} secciones</span>
        <span style={badge("#059669")}>{data.facturas.length} facturas</span>
        <span style={badge("#7C3AED")}>{data.gastos.length} gastos</span>
        <span style={badge("#64748B")}>{data.maestros.length} maestros</span>
      </div>
    </div>
  </div>);
}

// ── CONFIGURACIÓN (mora por sección + materiales por sección) ──
function ConfiguracionPage({data,loadData,showToast}){
  const[editSec,setEditSec]=useState(null); // sección en edición de mora
  const[moraForm,setMoraForm]=useState({mora_activa:false,mora_porcentaje:""});
  const[matModal,setMatModal]=useState(null); // {seccion_id} o {id} para editar
  const[matForm,setMatForm]=useState({nombre:"",precio_venta:"",costo:"",seccion_id:""});

  const abrirMora=(s)=>{setMoraForm({mora_activa:s.mora_activa===true,mora_porcentaje:s.mora_porcentaje||""});setEditSec(s.id);};
  const guardarMora=async()=>{
    try{
      await db.update("secciones",editSec,{mora_activa:moraForm.mora_activa===true,mora_porcentaje:parseFloat(moraForm.mora_porcentaje)||0});
      await loadData();setEditSec(null);showToast("Configuración de mora guardada");
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const abrirMat=(seccion_id,mat=null)=>{
    if(mat){setMatForm({nombre:mat.nombre,precio_venta:mat.precio_venta||"",costo:mat.costo||"",seccion_id:mat.seccion_id});setMatModal(mat.id);}
    else{setMatForm({nombre:"",precio_venta:"",costo:"",seccion_id});setMatModal("new");}
  };
  const guardarMat=async()=>{
    if(!matForm.nombre){showToast("Ponle nombre al material","error");return;}
    try{
      const row={nombre:matForm.nombre,precio_venta:parseFloat(matForm.precio_venta)||0,costo:parseFloat(matForm.costo)||0,seccion_id:matForm.seccion_id};
      if(matModal==="new"){await db.insert("materiales",{id:uid(),...row,activo:true});showToast("Material agregado");}
      else{await db.update("materiales",matModal,row);showToast("Material actualizado");}
      await loadData();setMatModal(null);
    }catch(e){showToast("Error: "+e.message,"error");}
  };
  const borrarMat=async(id)=>{if(!confirm("¿Eliminar este material?"))return;try{await db.remove("materiales",id);await loadData();showToast("Eliminado","error");}catch(e){showToast("Error: "+e.message,"error");}};

  return(<div>
    <div style={{...card,background:"#F5F3FF",border:"1px solid #DDD6FE"}}>
      <h3 style={{fontSize:15,fontWeight:700,color:"#5B21B6",margin:"0 0 6px"}}>⚙️ Configuración por sección</h3>
      <p style={{fontSize:13,color:"#6D28D9",margin:0}}>Aquí defines, para cada sección: el recargo por atraso (mora) y los materiales que vendes (libros, llaves) con su precio y costo.</p>
    </div>

    {data.secciones.length===0&&<div style={card}><p style={{fontSize:13,color:"#94A3B8",textAlign:"center"}}>Primero crea secciones en la pestaña "Secciones".</p></div>}

    {data.secciones.map(s=>{
      const mats=data.materiales.filter(m=>m.seccion_id===s.id);
      return(<div key={s.id} style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1E293B",margin:0}}>📚 {s.nombre} <span style={{fontSize:12,color:"#94A3B8",fontWeight:400}}>— L {Number(s.mensualidad).toLocaleString()}/mes</span></h3>
        </div>

        {/* MORA */}
        <div style={{background:"#F8FAFC",borderRadius:8,padding:12,marginBottom:12,border:"1px solid #E2E8F0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#475569"}}>⏰ Recargo por atraso (mora)</div>
              {s.mora_activa===true&&Number(s.mora_porcentaje)>0
                ? <div style={{fontSize:12,color:"#059669",fontWeight:600}}>Activo: {s.mora_porcentaje}% de la mensualidad por cada mes de atraso</div>
                : <div style={{fontSize:12,color:"#94A3B8"}}>Desactivado (sin recargo)</div>}
            </div>
            <button onClick={()=>abrirMora(s)} style={btnO}><Edit size={13}/>Configurar mora</button>
          </div>
        </div>

        {/* MATERIALES */}
        <div style={{background:"#FFFBEB",borderRadius:8,padding:12,border:"1px solid #FDE68A"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:mats.length?10:0,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:13,fontWeight:700,color:"#92400E"}}>📦 Materiales de esta sección (libros, llaves)</div>
            <button onClick={()=>abrirMat(s.id)} style={btn("#D97706")}><Plus size={13}/>Agregar material</button>
          </div>
          {mats.length>0&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"1px solid #FDE68A"}}>{["Material","Precio venta","Costo","Ganancia",""].map(h=><th key={h} style={{textAlign:["Precio venta","Costo","Ganancia"].includes(h)?"right":"left",padding:"5px 8px",color:"#92400E",fontWeight:600}}>{h}</th>)}</tr></thead>
            <tbody>{mats.map(m=>{const g=Number(m.precio_venta)-Number(m.costo);return(<tr key={m.id} style={{borderBottom:"1px solid #FEF3C7"}}>
              <td style={{padding:"5px 8px",fontWeight:600}}>{m.nombre}</td>
              <td style={{padding:"5px 8px",textAlign:"right"}}>L {Number(m.precio_venta).toLocaleString()}</td>
              <td style={{padding:"5px 8px",textAlign:"right",color:"#DC2626"}}>L {Number(m.costo).toLocaleString()}</td>
              <td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:"#059669"}}>L {g.toLocaleString()}</td>
              <td style={{padding:"5px 8px",textAlign:"right",whiteSpace:"nowrap"}}>
                <button onClick={()=>abrirMat(s.id,m)} style={{background:"none",border:"none",cursor:"pointer",padding:3}}><Edit size={13} color="#64748B"/></button>
                <button onClick={()=>borrarMat(m.id)} style={{background:"none",border:"none",cursor:"pointer",padding:3}}><Trash2 size={13} color="#EF4444"/></button>
              </td></tr>);})}</tbody>
          </table></div>}
        </div>
      </div>);
    })}

    {/* Modal mora */}
    {editSec&&<Modal title="⏰ Configurar recargo por atraso" onClose={()=>setEditSec(null)} onSave={guardarMora}>
      <div onClick={()=>setMoraForm({...moraForm,mora_activa:!moraForm.mora_activa})} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",border:moraForm.mora_activa?"2px solid #059669":"1px solid #D1D5DB",background:moraForm.mora_activa?"#ECFDF5":"#fff",display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{width:20,height:20,borderRadius:5,border:moraForm.mora_activa?"none":"2px solid #D1D5DB",background:moraForm.mora_activa?"#059669":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{moraForm.mora_activa&&<Check size={14} color="#fff"/>}</div>
        <div><div style={{fontSize:13,fontWeight:700,color:moraForm.mora_activa?"#059669":"#475569"}}>Aplicar recargo por atraso</div><div style={{fontSize:11,color:"#94A3B8"}}>Si está apagado, esta sección no tiene mora</div></div>
      </div>
      {moraForm.mora_activa&&<div style={{marginBottom:12}}>
        <label style={label}>Porcentaje de recargo (%)</label>
        <input type="number" value={moraForm.mora_porcentaje} onChange={e=>setMoraForm({...moraForm,mora_porcentaje:e.target.value})} placeholder="Ej: 12" style={input}/>
        <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>Se cobra este % de la mensualidad por CADA mes de atraso. Ej: 12% en una mensualidad de L 1,000 con 2 meses de atraso = L 240.</div>
      </div>}
    </Modal>}

    {/* Modal material */}
    {matModal&&<Modal title={matModal==="new"?"📦 Nuevo material":"Editar material"} onClose={()=>setMatModal(null)} onSave={guardarMat}>
      <Field label="Nombre del material" value={matForm.nombre} onChange={v=>setMatForm({...matForm,nombre:v})} placeholder="Ej: Llave digital Top Notch 2"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Precio de venta (L)" value={matForm.precio_venta} onChange={v=>setMatForm({...matForm,precio_venta:v})} type="number" placeholder="1000"/>
        <Field label="Costo real (L)" value={matForm.costo} onChange={v=>setMatForm({...matForm,costo:v})} type="number" placeholder="560"/>
      </div>
      {(matForm.precio_venta||matForm.costo)&&<div style={{background:"#ECFDF5",border:"1px solid #BBF7D0",borderRadius:8,padding:10,fontSize:13,color:"#059669",fontWeight:700}}>
        Ganancia por unidad: L {((parseFloat(matForm.precio_venta)||0)-(parseFloat(matForm.costo)||0)).toLocaleString()}
      </div>}
    </Modal>}
  </div>);
}

// ── MATERIALES (cobro + comprobante, igual que mensualidades) ──
function MaterialesPage({data,loadData,showToast}){
  const[tab,setTab]=useState("cobros");
  const[modal,setModal]=useState(null);
  const[imgPreview,setImgPreview]=useState(null);
  const[form,setForm]=useState({seccion_id:"",material_id:"",alumno_id:"",cantidad:"1",tipo_pago:"efectivo",mes_correspondiente:MESES[new Date().getMonth()],notas:"",pagar_ya:false});
  const[filtroSec,setFiltroSec]=useState("");
  const[compForm,setCompForm]=useState(null); // venta pendiente que se está cobrando
  const[bulkMat,setBulkMat]=useState({seccion_id:"",material_id:"",mes_correspondiente:MESES[new Date().getMonth()],alumnos:[]});

  const matsSeccion=form.seccion_id?data.materiales.filter(m=>m.seccion_id===form.seccion_id&&m.activo!==false):[];
  const alumnosSeccion=form.seccion_id?data.alumnos.filter(a=>a.seccion_id===form.seccion_id&&a.estado==="activo"):[];

  // Mostrar imagen (cobro o comprobante) de una venta
  const mostrarImagen=(v,tipo)=>{
    const al=data.alumnos.find(a=>a.id===v.alumno_id);
    const padre=al?data.padres.find(p=>p.id===al.padre_id):null;
    const sec=data.secciones.find(s=>s.id===v.seccion_id);
    const dataUrl=generarImgMaterial(v,al,padre,sec,tipo);
    setImgPreview({dataUrl,phone:padre?.telefono||"",destinatario:padre?.nombre||al?.nombre||"",numero:v.numero});
  };

  const abrir=()=>{setForm({seccion_id:"",material_id:"",alumno_id:"",cantidad:"1",tipo_pago:"efectivo",mes_correspondiente:MESES[new Date().getMonth()],notas:"",pagar_ya:false});setModal("new");};

  // Crear cobros de un material para VARIOS alumnos de una sección a la vez.
  // Se crean como cobros pendientes (luego se confirma el pago de cada uno).
  const crearCobrosMaterialSeccion = async () => {
    if(!bulkMat.material_id){showToast("Selecciona el material","error");return;}
    if(bulkMat.alumnos.length===0){showToast("Selecciona al menos un alumno","error");return;}
    try{
      const mat=data.materiales.find(m=>m.id===bulkMat.material_id);
      const pv=Number(mat.precio_venta), co=Number(mat.costo);
      let n=data.ventas_material.length;
      const nuevas=bulkMat.alumnos.map(aid=>{
        n++;
        return {id:uid(),numero:`MT-${String(n).padStart(4,"0")}`,material_id:mat.id,alumno_id:aid,seccion_id:bulkMat.seccion_id,nombre_material:mat.nombre,precio_venta:pv,costo:co,ganancia:pv-co,cantidad:1,fecha_venta:new Date().toISOString().split("T")[0],mes_correspondiente:bulkMat.mes_correspondiente,estado:"pendiente",fecha_pago:null,tipo_pago:"efectivo",notas:""};
      });
      await db.insertMany("ventas_material",nuevas);
      await loadData();setModal(null);
      showToast(`✓ ${nuevas.length} cobros de "${mat.nombre}" creados`);
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  // Crear la venta: como cobro pendiente, o pagada de una vez
  const guardar=async()=>{
    if(!form.material_id){showToast("Selecciona el material","error");return;}
    if(!form.alumno_id){showToast("Selecciona el alumno","error");return;}
    try{
      const mat=data.materiales.find(m=>m.id===form.material_id);
      const cant=parseInt(form.cantidad)||1;
      const pv=Number(mat.precio_venta), co=Number(mat.costo);
      const num=`MT-${String(data.ventas_material.length+1).padStart(4,"0")}`;
      const hoy=new Date().toISOString().split("T")[0];
      const venta={id:uid(),numero:num,material_id:mat.id,alumno_id:form.alumno_id,seccion_id:form.seccion_id,nombre_material:mat.nombre,precio_venta:pv*cant,costo:co*cant,ganancia:(pv-co)*cant,cantidad:cant,fecha_venta:hoy,mes_correspondiente:form.mes_correspondiente,estado:form.pagar_ya?"pagado":"pendiente",fecha_pago:form.pagar_ya?hoy:null,tipo_pago:form.tipo_pago,notas:form.notas};
      await db.insert("ventas_material",venta);
      await loadData();setModal(null);
      if(form.pagar_ya){setTimeout(()=>mostrarImagen(venta,"comprobante"),300);showToast(`✓ ${num} pagado — comprobante listo`);}
      else{setTimeout(()=>mostrarImagen(venta,"cobro"),300);showToast(`✓ Cobro ${num} creado`);}
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  // Confirmar pago de un cobro pendiente
  const confirmarPago=async(v,tipoPago)=>{
    try{
      const hoy=new Date().toISOString().split("T")[0];
      await db.update("ventas_material",v.id,{estado:"pagado",fecha_pago:hoy,tipo_pago:tipoPago||v.tipo_pago||"efectivo"});
      await loadData();setCompForm(null);
      const actualizada={...v,estado:"pagado",fecha_pago:hoy,tipo_pago:tipoPago||v.tipo_pago};
      setTimeout(()=>mostrarImagen(actualizada,"comprobante"),300);
      showToast("Pago confirmado ✓ — comprobante listo");
    }catch(e){showToast("Error: "+e.message,"error");}
  };

  const anular=async(v)=>{if(!confirm("¿Anular esta venta?"))return;try{await db.update("ventas_material",v.id,{estado:"anulado"});await loadData();showToast("Anulada","error");}catch(e){showToast("Error: "+e.message,"error");}};

  const todas=data.ventas_material.filter(v=>!filtroSec||v.seccion_id===filtroSec);
  const cobros=todas.filter(v=>v.estado==="pendiente");
  const pagados=todas.filter(v=>v.estado==="pagado");
  const totVenta=pagados.reduce((s,v)=>s+Number(v.precio_venta),0);
  const totGanancia=pagados.reduce((s,v)=>s+Number(v.ganancia),0);
  const totPend=cobros.reduce((s,v)=>s+Number(v.precio_venta),0);
  const tBtn=(a)=>({padding:"10px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",borderBottom:a?"3px solid #D97706":"3px solid transparent",background:"transparent",color:a?"#D97706":"#64748B"});

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <select value={filtroSec} onChange={e=>setFiltroSec(e.target.value)} style={{...input,width:200,cursor:"pointer"}}>
        <option value="">Todas las secciones</option>
        {data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>{setBulkMat({seccion_id:"",material_id:"",mes_correspondiente:MESES[new Date().getMonth()],alumnos:[]});setModal("bulkmat");}} style={btn("#7C3AED")}><Users size={15}/>Cobrar a una sección</button>
        <button onClick={abrir} style={btn("#D97706")}><Plus size={15}/>Registrar material</button>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
      <div style={{...card,borderLeft:"3px solid #DC2626",margin:0}}><div style={{fontSize:12,color:"#64748B"}}>Pendiente de cobro</div><div style={{fontSize:20,fontWeight:800,color:"#DC2626"}}>L {totPend.toLocaleString()}</div></div>
      <div style={{...card,borderLeft:"3px solid #D97706",margin:0}}><div style={{fontSize:12,color:"#64748B"}}>Total cobrado</div><div style={{fontSize:20,fontWeight:800,color:"#D97706"}}>L {totVenta.toLocaleString()}</div></div>
      <div style={{...card,borderLeft:"3px solid #059669",margin:0}}><div style={{fontSize:12,color:"#64748B"}}>Ganancia cobrada</div><div style={{fontSize:20,fontWeight:800,color:"#059669"}}>L {totGanancia.toLocaleString()}</div></div>
    </div>

    <div style={{display:"flex",borderBottom:"1px solid #E2E8F0",marginBottom:16}}>
      <button onClick={()=>setTab("cobros")} style={tBtn(tab==="cobros")}>📄 Cobros pendientes ({cobros.length})</button>
      <button onClick={()=>setTab("pagados")} style={tBtn(tab==="pagados")}>✅ Pagados ({pagados.length})</button>
    </div>

    {/* COBROS PENDIENTES */}
    {tab==="cobros"&&<div style={card}>
      {cobros.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay cobros de material pendientes</p>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["No.","Material","Alumno","Sección","Cant.","Total","Mes",""].map(h=><th key={h} style={{textAlign:["Total","Cant."].includes(h)?"right":"left",padding:"5px 6px",color:"#64748B",fontWeight:600,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{[...cobros].reverse().map(v=>{const al=data.alumnos.find(a=>a.id===v.alumno_id);const sec=data.secciones.find(s=>s.id===v.seccion_id);return(<tr key={v.id} style={{borderBottom:"1px solid #F1F5F9"}}>
            <td style={{padding:"5px 6px",fontWeight:600}}>{v.numero}</td>
            <td style={{padding:"5px 6px"}}>{v.nombre_material}</td>
            <td style={{padding:"5px 6px"}}>{al?.nombre||"—"}</td>
            <td style={{padding:"5px 6px"}}>{sec?<span style={badge("#F97316")}>{sec.nombre}</span>:"—"}</td>
            <td style={{padding:"5px 6px",textAlign:"right"}}>{v.cantidad}</td>
            <td style={{padding:"5px 6px",textAlign:"right",fontWeight:700,color:"#DC2626"}}>L {Number(v.precio_venta).toLocaleString()}</td>
            <td style={{padding:"5px 6px"}}>{v.mes_correspondiente}</td>
            <td style={{padding:"5px 6px",textAlign:"right",whiteSpace:"nowrap"}}>
              <button onClick={()=>mostrarImagen(v,"cobro")} title="Enviar cobro" style={{background:"#25D366",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:4,marginRight:3}}><Phone size={12} color="#fff"/></button>
              <button onClick={()=>setCompForm({venta:v,tipo_pago:v.tipo_pago||"efectivo"})} title="Confirmar pago" style={{background:"#059669",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:4,marginRight:3}}><Check size={12} color="#fff"/></button>
              <button onClick={()=>anular(v)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color="#DC2626"/></button>
            </td></tr>);})}</tbody>
        </table></div>
      )}
    </div>}

    {/* PAGADOS */}
    {tab==="pagados"&&<div style={card}>
      {pagados.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay materiales pagados aún</p>:(
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["No.","Material","Alumno","Sección","Cant.","Venta","Ganancia","Fecha pago",""].map(h=><th key={h} style={{textAlign:["Venta","Ganancia","Cant."].includes(h)?"right":"left",padding:"5px 6px",color:"#64748B",fontWeight:600,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{[...pagados].reverse().map(v=>{const al=data.alumnos.find(a=>a.id===v.alumno_id);const sec=data.secciones.find(s=>s.id===v.seccion_id);return(<tr key={v.id} style={{borderBottom:"1px solid #F1F5F9"}}>
            <td style={{padding:"5px 6px",fontWeight:600}}>{v.numero}</td>
            <td style={{padding:"5px 6px"}}>{v.nombre_material}</td>
            <td style={{padding:"5px 6px"}}>{al?.nombre||"—"}</td>
            <td style={{padding:"5px 6px"}}>{sec?<span style={badge("#F97316")}>{sec.nombre}</span>:"—"}</td>
            <td style={{padding:"5px 6px",textAlign:"right"}}>{v.cantidad}</td>
            <td style={{padding:"5px 6px",textAlign:"right",fontWeight:600}}>L {Number(v.precio_venta).toLocaleString()}</td>
            <td style={{padding:"5px 6px",textAlign:"right",fontWeight:700,color:"#059669"}}>L {Number(v.ganancia).toLocaleString()}</td>
            <td style={{padding:"5px 6px"}}>{v.fecha_pago||"—"}</td>
            <td style={{padding:"5px 6px",textAlign:"center"}}><button onClick={()=>mostrarImagen(v,"comprobante")} title="Ver/enviar comprobante" style={{background:"#059669",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:4,display:"inline-flex",alignItems:"center",gap:4,color:"#fff",fontSize:11,fontWeight:600}}><Send size={11}/>Enviar</button></td>
          </tr>);})}</tbody>
        </table></div>
      )}
    </div>}

    {/* Modal registrar */}
    {modal==="bulkmat"&&<Modal title="👥 Cobrar material a una sección" onClose={()=>setModal(null)} onSave={crearCobrosMaterialSeccion} wide>
      <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:8,padding:10,fontSize:12,color:"#6D28D9",marginBottom:14}}>
        Crea el cobro del mismo material (ej: una llave) a varios alumnos de la sección de una vez. Quedan como cobros pendientes; luego confirmás el pago de cada uno.
      </div>
      <div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}>
        <div>
          <div style={{marginBottom:12}}><label style={label}>Sección *</label>
            <select value={bulkMat.seccion_id} onChange={e=>setBulkMat({...bulkMat,seccion_id:e.target.value,material_id:"",alumnos:[]})} style={{...input,cursor:"pointer"}}>
              <option value="">Seleccionar</option>
              {data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}><label style={label}>Material *</label>
            <select value={bulkMat.material_id} onChange={e=>setBulkMat({...bulkMat,material_id:e.target.value})} style={{...input,cursor:"pointer"}} disabled={!bulkMat.seccion_id}>
              <option value="">{bulkMat.seccion_id?"Seleccionar":"Elige sección primero"}</option>
              {(bulkMat.seccion_id?data.materiales.filter(m=>m.seccion_id===bulkMat.seccion_id&&m.activo!==false):[]).map(m=><option key={m.id} value={m.id}>{m.nombre} — L {Number(m.precio_venta).toLocaleString()}</option>)}
            </select>
            {bulkMat.seccion_id&&data.materiales.filter(m=>m.seccion_id===bulkMat.seccion_id).length===0&&<div style={{fontSize:11,color:"#DC2626",marginTop:4}}>Esta sección no tiene materiales. Agrégalos en "Configuración".</div>}
          </div>
          <div style={{marginBottom:12}}><label style={label}>Mes</label>
            <select value={bulkMat.mes_correspondiente} onChange={e=>setBulkMat({...bulkMat,mes_correspondiente:e.target.value})} style={{...input,cursor:"pointer"}}>{MESES.map(m=><option key={m} value={m}>{m}</option>)}</select>
          </div>
        </div>
        <div>
          {bulkMat.seccion_id&&(()=>{
            const als=data.alumnos.filter(a=>a.seccion_id===bulkMat.seccion_id&&a.estado==="activo");
            if(als.length===0)return<div style={{background:"#F8FAFC",borderRadius:8,padding:20,textAlign:"center",color:"#94A3B8",fontSize:13}}>No hay alumnos activos en esta sección</div>;
            const todosSel=bulkMat.alumnos.length===als.length;
            return(<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <label style={{...label,margin:0}}>Alumnos ({bulkMat.alumnos.length}/{als.length})</label>
                <button onClick={()=>setBulkMat({...bulkMat,alumnos:todosSel?[]:als.map(a=>a.id)})} style={{...btnO,padding:"4px 10px",fontSize:11}}>{todosSel?"Ninguno":"Todos"}</button>
              </div>
              <div style={{maxHeight:220,overflowY:"auto",border:"1px solid #E2E8F0",borderRadius:8,padding:6}}>
                {als.map(a=>{const sel=bulkMat.alumnos.includes(a.id);return(
                  <div key={a.id} onClick={()=>{const arr=sel?bulkMat.alumnos.filter(x=>x!==a.id):[...bulkMat.alumnos,a.id];setBulkMat({...bulkMat,alumnos:arr});}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",background:sel?"#F5F3FF":"transparent"}}>
                    <div style={{width:18,height:18,borderRadius:4,border:sel?"none":"2px solid #D1D5DB",background:sel?"#7C3AED":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<Check size={12} color="#fff"/>}</div>
                    <span style={{fontSize:13}}>{a.nombre}</span>
                  </div>);})}
              </div>
              {bulkMat.material_id&&bulkMat.alumnos.length>0&&(()=>{const mat=data.materiales.find(m=>m.id===bulkMat.material_id);const tot=Number(mat?.precio_venta)*bulkMat.alumnos.length;return(
                <div style={{marginTop:10,padding:10,background:"#ECFDF5",border:"1px solid #BBF7D0",borderRadius:8,fontSize:13}}>
                  <div style={{fontWeight:700,color:"#166534"}}>{bulkMat.alumnos.length} cobros de "{mat?.nombre}"</div>
                  <div style={{color:"#059669"}}>Total a cobrar: <strong>L {tot.toLocaleString()}</strong></div>
                </div>);})()}
            </div>);
          })()}
          {!bulkMat.seccion_id&&<div style={{background:"#F8FAFC",borderRadius:8,padding:20,textAlign:"center",color:"#94A3B8",fontSize:13}}>Selecciona una sección</div>}
        </div>
      </div>
    </Modal>}

    {modal==="new"&&<Modal title="📦 Registrar material" onClose={()=>setModal(null)} onSave={guardar} wide>
      <div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}>
        <div>
          <div style={{marginBottom:12}}><label style={label}>Sección *</label>
            <select value={form.seccion_id} onChange={e=>setForm({...form,seccion_id:e.target.value,material_id:"",alumno_id:""})} style={{...input,cursor:"pointer"}}>
              <option value="">Seleccionar</option>
              {data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}><label style={label}>Material *</label>
            <select value={form.material_id} onChange={e=>setForm({...form,material_id:e.target.value})} style={{...input,cursor:"pointer"}} disabled={!form.seccion_id}>
              <option value="">{form.seccion_id?"Seleccionar":"Elige sección primero"}</option>
              {matsSeccion.map(m=><option key={m.id} value={m.id}>{m.nombre} — L {Number(m.precio_venta).toLocaleString()}</option>)}
            </select>
            {form.seccion_id&&matsSeccion.length===0&&<div style={{fontSize:11,color:"#DC2626",marginTop:4}}>Esta sección no tiene materiales. Agrégalos en "Configuración".</div>}
          </div>
          <div style={{marginBottom:12}}><label style={label}>Alumno *</label>
            <select value={form.alumno_id} onChange={e=>setForm({...form,alumno_id:e.target.value})} style={{...input,cursor:"pointer"}} disabled={!form.seccion_id}>
              <option value="">{form.seccion_id?"Seleccionar":"Elige sección primero"}</option>
              {alumnosSeccion.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Cantidad" value={form.cantidad} onChange={v=>setForm({...form,cantidad:v})} type="number"/>
            <div style={{marginBottom:12}}><label style={label}>Mes</label><select value={form.mes_correspondiente} onChange={e=>setForm({...form,mes_correspondiente:e.target.value})} style={{...input,cursor:"pointer"}}>{MESES.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
          </div>
          {/* Interruptor: pagar ya o dejar pendiente */}
          <div onClick={()=>setForm({...form,pagar_ya:!form.pagar_ya})} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",border:form.pagar_ya?"2px solid #059669":"1px solid #D1D5DB",background:form.pagar_ya?"#ECFDF5":"#fff",display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:20,height:20,borderRadius:5,border:form.pagar_ya?"none":"2px solid #D1D5DB",background:form.pagar_ya?"#059669":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{form.pagar_ya&&<Check size={14} color="#fff"/>}</div>
            <div><div style={{fontSize:13,fontWeight:700,color:form.pagar_ya?"#059669":"#475569"}}>Ya está pagado</div><div style={{fontSize:11,color:"#94A3B8"}}>{form.pagar_ya?"Se genera el comprobante de una vez":"Se crea como cobro pendiente"}</div></div>
          </div>
          {form.pagar_ya&&<div style={{marginBottom:12}}><label style={label}>Tipo de pago</label><select value={form.tipo_pago} onChange={e=>setForm({...form,tipo_pago:e.target.value})} style={{...input,cursor:"pointer"}}>{TIPOS_PAGO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>}
          {form.material_id&&(()=>{const mat=data.materiales.find(m=>m.id===form.material_id);const cant=parseInt(form.cantidad)||1;const pv=Number(mat?.precio_venta)*cant;const g=(Number(mat?.precio_venta)-Number(mat?.costo))*cant;return(
            <div style={{background:"#ECFDF5",border:"1px solid #BBF7D0",borderRadius:8,padding:12,fontSize:13}}>
              <div style={{color:"#166534",fontWeight:700,marginBottom:4}}>Resumen</div>
              <div>Total a cobrar: <strong>L {pv.toLocaleString()}</strong></div>
              <div style={{color:"#059669"}}>Tu ganancia: <strong>L {g.toLocaleString()}</strong></div>
            </div>);})()}
        </div>
      </div>
    </Modal>}

    {/* Modal confirmar pago de un cobro pendiente */}
    {compForm&&<Modal title="✅ Confirmar pago de material" onClose={()=>setCompForm(null)} onSave={()=>confirmarPago(compForm.venta,compForm.tipo_pago)}>
      {(()=>{const v=compForm.venta;const al=data.alumnos.find(a=>a.id===v.alumno_id);return(
        <div style={{background:"#F0FDF4",borderRadius:8,padding:12,marginBottom:12,fontSize:13,border:"1px solid #BBF7D0"}}>
          <div style={{fontWeight:700,color:"#166534",marginBottom:4}}>✓ {v.numero}</div>
          <div><strong>Material:</strong> {v.nombre_material} ×{v.cantidad}</div>
          <div><strong>Alumno:</strong> {al?.nombre}</div>
          <div><strong>Total:</strong> L {Number(v.precio_venta).toLocaleString()}</div>
        </div>);})()}
      <div style={{marginBottom:12}}><label style={label}>Tipo de pago</label>
        <select value={compForm.tipo_pago} onChange={e=>setCompForm({...compForm,tipo_pago:e.target.value})} style={{...input,cursor:"pointer"}}>{TIPOS_PAGO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select>
      </div>
    </Modal>}

    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
  </div>);
}


// ── REPORTES (resumen económico mensual completo) ──
function ReportesPage({data}){
  const[mesSel,setMesSel]=useState(MESES[new Date().getMonth()]);

  // Ingresos por mensualidades (comprobantes de cobro pagados ese mes)
  const compsMes=data.facturas.filter(f=>f.tipo_factura==="comprobante"&&f.mes_correspondiente===mesSel);
  const ingMensualidades=compsMes.reduce((s,f)=>s+Number(f.monto_total||0),0);

  // Ventas de materiales de ese mes
  // Ventas de materiales de ese mes. Solo las PAGADAS entran como ingreso.
  const ventasMes=data.ventas_material.filter(v=>v.mes_correspondiente===mesSel&&v.estado==="pagado");
  const ventasPendMes=data.ventas_material.filter(v=>v.mes_correspondiente===mesSel&&v.estado==="pendiente");
  const pendMateriales=ventasPendMes.reduce((s,v)=>s+Number(v.precio_venta),0);
  const ingMateriales=ventasMes.reduce((s,v)=>s+Number(v.precio_venta),0);
  const costoMateriales=ventasMes.reduce((s,v)=>s+Number(v.costo),0);
  const gananciaMateriales=ventasMes.reduce((s,v)=>s+Number(v.ganancia),0);

  // Gastos del mes
  const gastosMes=data.gastos.filter(g=>g.mes_correspondiente===mesSel);
  const totSalarios=gastosMes.filter(g=>g.tipo==="salario").reduce((s,g)=>s+Number(g.monto),0);
  const totRenta=gastosMes.filter(g=>g.tipo==="renta").reduce((s,g)=>s+Number(g.monto),0);
  const totOtros=gastosMes.filter(g=>g.tipo==="otro").reduce((s,g)=>s+Number(g.monto),0);
  const totGastos=totSalarios+totRenta+totOtros;

  // Ingreso total = mensualidades + venta de materiales (precio completo)
  const ingresoTotal=ingMensualidades+ingMateriales;
  // Resultado neto = ingresos - costo de materiales - gastos
  const resultado=ingMensualidades+gananciaMateriales-totGastos;

  const fila=(label,valor,color="#1E293B",bold=false)=>(
    <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
      <span style={{fontSize:13,color:"#475569",fontWeight:bold?700:400}}>{label}</span>
      <span style={{fontSize:13,fontWeight:bold?800:600,color}}>L {valor.toLocaleString()}</span>
    </div>);

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <h3 style={{fontSize:16,fontWeight:700,color:"#1E293B",margin:0}}>📊 Reporte económico — {mesSel}</h3>
      <select value={mesSel} onChange={e=>setMesSel(e.target.value)} style={{...input,width:180,cursor:"pointer"}}>
        {MESES.map(m=><option key={m} value={m}>{m}</option>)}
      </select>
    </div>

    {/* Tarjetas resumen */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:16}}>
      <div style={{...card,borderLeft:"3px solid #059669",margin:0}}><div style={{fontSize:12,color:"#64748B"}}>Ingreso total</div><div style={{fontSize:22,fontWeight:800,color:"#059669"}}>L {ingresoTotal.toLocaleString()}</div><div style={{fontSize:11,color:"#94A3B8"}}>mensualidades + materiales</div></div>
      <div style={{...card,borderLeft:"3px solid #DC2626",margin:0}}><div style={{fontSize:12,color:"#64748B"}}>Gastos</div><div style={{fontSize:22,fontWeight:800,color:"#DC2626"}}>L {totGastos.toLocaleString()}</div><div style={{fontSize:11,color:"#94A3B8"}}>salarios + renta + otros</div></div>
      <div style={{...card,borderLeft:`3px solid ${resultado>=0?"#059669":"#DC2626"}`,margin:0}}><div style={{fontSize:12,color:"#64748B"}}>{resultado>=0?"Ganancia neta":"Pérdida neta"}</div><div style={{fontSize:22,fontWeight:800,color:resultado>=0?"#059669":"#DC2626"}}>L {Math.abs(resultado).toLocaleString()}</div></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:window.innerWidth>700?"1fr 1fr":"1fr",gap:16}}>
      {/* INGRESOS */}
      <div style={card}>
        <h4 style={{fontSize:14,fontWeight:700,color:"#059669",margin:"0 0 10px"}}>💰 Ingresos</h4>
        {fila("Mensualidades cobradas",ingMensualidades,"#059669")}
        {fila("Venta de materiales (pagados)",ingMateriales,"#D97706")}
        {pendMateriales>0&&fila("Materiales por cobrar (pendiente)",pendMateriales,"#94A3B8")}
        <div style={{marginTop:6,paddingTop:6}}>{fila("Total ingresos",ingresoTotal,"#059669",true)}</div>
        <div style={{marginTop:14,fontSize:12,color:"#64748B"}}>
          <div style={{fontWeight:700,marginBottom:4}}>Materiales cobrados este mes:</div>
          {ventasMes.length===0?<div style={{color:"#94A3B8"}}>Sin materiales cobrados este mes</div>:ventasMes.slice(0,8).map(v=>(
            <div key={v.id} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>{v.nombre_material} ×{v.cantidad}</span><span>L {Number(v.precio_venta).toLocaleString()}</span></div>
          ))}
        </div>
      </div>

      {/* EGRESOS Y GANANCIA */}
      <div style={card}>
        <h4 style={{fontSize:14,fontWeight:700,color:"#DC2626",margin:"0 0 10px"}}>📉 Gastos y resultado</h4>
        {fila("Salarios a maestros",totSalarios,"#DC2626")}
        {fila("Renta",totRenta,"#DC2626")}
        {fila("Otros gastos",totOtros,"#DC2626")}
        {fila("Costo de materiales vendidos",costoMateriales,"#DC2626")}
        <div style={{marginTop:14,padding:12,background:resultado>=0?"#ECFDF5":"#FEF2F2",borderRadius:8}}>
          <div style={{fontSize:12,color:"#64748B",marginBottom:6}}>Cálculo del resultado:</div>
          <div style={{fontSize:12,color:"#475569"}}>Mensualidades: L {ingMensualidades.toLocaleString()}</div>
          <div style={{fontSize:12,color:"#475569"}}>+ Ganancia materiales: L {gananciaMateriales.toLocaleString()}</div>
          <div style={{fontSize:12,color:"#475569"}}>− Gastos: L {totGastos.toLocaleString()}</div>
          <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid #D1D5DB",fontSize:16,fontWeight:800,color:resultado>=0?"#059669":"#DC2626"}}>
            = L {resultado.toLocaleString()} {resultado>=0?"✓":""}
          </div>
        </div>
      </div>
    </div>

    {/* Nota explicativa */}
    <div style={{...card,background:"#F8FAFC",marginTop:16}}>
      <div style={{fontSize:12,color:"#64748B"}}>
        <strong>Nota:</strong> El "Ingreso total" cuenta el precio completo de los materiales (lo que entra a caja). El "Resultado neto" usa solo la <em>ganancia</em> de los materiales (precio − costo), porque el costo es dinero que sale para reponerlos. Así el resultado refleja tu utilidad real.
      </div>
    </div>
  </div>);
}

// ── COMPONENTES ──
function Modal({title,onClose,onSave,children,wide}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}><div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:wide?640:440,maxHeight:"90vh",overflow:"auto"}}><div style={{padding:"16px 20px",borderBottom:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontSize:15,fontWeight:700,margin:0,color:"#1E293B"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} color="#64748B"/></button></div><div style={{padding:20}}>{children}</div><div style={{padding:"0 20px 16px",display:"flex",justifyContent:"flex-end",gap:10}}><button onClick={onClose} style={btnO}>Cancelar</button><button onClick={onSave} style={btn()}>Guardar</button></div></div></div>);
}
function Field({label:lbl,value,onChange,type="text",placeholder,multiline}){
  return(<div style={{marginBottom:12}}><label style={label}>{lbl}</label>{multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{...input,resize:"vertical"}}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={input}/>}</div>);
}
