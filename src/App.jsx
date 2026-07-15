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
const MORA_MENSUAL = 50; // ← Cambia aquí el monto de mora mensual

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

const calcMora = (f) => {
  if (!f || f.estado === "pagada" || f.estado === "anulada" || f.tipo_factura === "comprobante") return 0;
  const hoy = new Date();
  const mesIdx = MESES.indexOf(f.mes_correspondiente);
  if (mesIdx === -1) return 0;
  const year = parseInt(String(f.fecha_emision||"").split("-")[0]) || hoy.getFullYear();
  const deadline = new Date(year, mesIdx, 28, 23, 59, 59);
  if (hoy <= deadline) return 0;
  return Math.max(1, Math.ceil((hoy - deadline) / (1000*60*60*24*30))) * MORA_MENSUAL;
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

// ══════════════════════════
//  APP PRINCIPAL
// ══════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState({ maestros:[], secciones:[], padres:[], alumnos:[], facturas:[], gastos:[] });
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
      const [maestros,secciones,padres,alumnos,facturas,gastos] = await Promise.all([
        db.all("maestros"), db.all("secciones"), db.all("padres"),
        db.all("alumnos"), db.all("facturas"), db.all("gastos")
      ]);
      setData({maestros,secciones,padres,alumnos,facturas,gastos});
    } catch(e) { showToast("Error cargando datos: "+e.message,"error"); }
  }, []);

  useEffect(() => { if(session) loadData(); }, [session, loadData]);

  const logout = async () => { await supabase.auth.signOut(); setSession(null); };

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F8FAFC"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🌱</div><p style={{color:"#64748B"}}>Cargando Seeds...</p></div></div>;
  if (!session) return <LoginPage showToast={showToast} toast={toast} />;

  const NAV = [
    {id:"dashboard",label:"Inicio",icon:Home},{id:"secciones",label:"Secciones",icon:BookOpen},
    {id:"maestros",label:"Maestros",icon:GraduationCap},{id:"alumnos",label:"Matrícula",icon:Users},
    {id:"facturas",label:"Facturas",icon:FileText},{id:"historial",label:"Historial",icon:CreditCard},
    {id:"recordatorios",label:"Recordatorios",icon:Bell},{id:"finanzas",label:"Finanzas",icon:DollarSign},
    {id:"sistema",label:"Sistema",icon:LogIn},
  ];

  const props = { data, loadData, showToast };
  const pageMap = {
    dashboard:<Dashboard data={data} setPage={setPage}/>,
    secciones:<SeccionesPage {...props}/>,
    maestros:<MaestrosPage {...props}/>,
    alumnos:<AlumnosPage {...props}/>,
    facturas:<FacturasPage {...props}/>,
    historial:<HistorialPage {...props}/>,
    recordatorios:<RecordatoriosPage {...props}/>,
    finanzas:<FinanzasPage {...props}/>,
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
  const ing=data.facturas.filter(f=>f.tipo_factura==="comprobante"&&f.mes_correspondiente===mes).reduce((s,f)=>s+(Number(f.monto_total)||0),0);
  const gastos=data.gastos.filter(g=>g.mes_correspondiente===mes).reduce((s,g)=>s+(Number(g.monto)||0),0);
  const ganancia=ing-gastos;
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
  const[form,setForm]=useState({nombre:"",telefono:"",email:"",padre_nombre:"",padre_telefono:"",padre_email:"",seccion_id:"",padre_id:"",monto_personalizado:""});
  const open=(al=null)=>{if(al){const p=data.padres.find(p=>p.id===al.padre_id)||{};setForm({nombre:al.nombre,telefono:al.telefono||"",email:al.email||"",padre_nombre:p.nombre||"",padre_telefono:p.telefono||"",padre_email:p.email||"",seccion_id:al.seccion_id||"",padre_id:al.padre_id||"",monto_personalizado:al.monto_personalizado||""});}else{setForm({nombre:"",telefono:"",email:"",padre_nombre:"",padre_telefono:"",padre_email:"",seccion_id:"",padre_id:"",monto_personalizado:""});}setModal(al?.id||"new");};
  const sv=async()=>{
    if(!form.nombre||!form.padre_nombre){showToast("Nombre del alumno y padre requeridos","error");return;}
    try{
      let padreId=form.padre_id;
      const padreRow={nombre:form.padre_nombre,telefono:form.padre_telefono,email:form.padre_email};
      if(padreId){await db.update("padres",padreId,padreRow);}
      else{padreId=uid();await db.insert("padres",{id:padreId,...padreRow});}
      const alRow={nombre:form.nombre,telefono:form.telefono,email:form.email,padre_id:padreId,seccion_id:form.seccion_id||null,monto_personalizado:parseFloat(form.monto_personalizado)||0};
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
    <div style={card}>{filtered.length===0?<p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:20}}>No hay alumnos</p>:(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:600}}><thead><tr style={{borderBottom:"2px solid #E2E8F0"}}>{["Alumno","Padre","Tel. Padre","Sección","Monto","Estado",""].map(h=><th key={h} style={{textAlign:h===""?"center":"left",padding:"8px 10px",color:"#64748B",fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead><tbody>{filtered.map(a=>{const p=data.padres.find(p=>p.id===a.padre_id);const sec=data.secciones.find(s=>s.id===a.seccion_id);const sc={activo:"#059669",inactivo:"#DC2626",graduado:"#7C3AED"};const m=(Number(a.monto_personalizado)>0)?Number(a.monto_personalizado):Number(sec?.mensualidad)||0;return(<tr key={a.id} style={{borderBottom:"1px solid #F1F5F9"}}><td style={{padding:"8px 10px"}}><div style={{fontWeight:600}}>{a.nombre}</div>{a.telefono&&<div style={{fontSize:11,color:"#94A3B8"}}>{a.telefono}</div>}</td><td style={{padding:"8px 10px"}}>{p?.nombre||"—"}</td><td style={{padding:"8px 10px"}}>{p?.telefono||"—"}</td><td style={{padding:"8px 10px"}}>{sec?<span style={badge("#F97316")}>{sec.nombre}</span>:"—"}</td><td style={{padding:"8px 10px"}}>{m?<span style={{fontWeight:600,color:Number(a.monto_personalizado)>0?"#7C3AED":"#1E293B"}}>L {m.toLocaleString()}{Number(a.monto_personalizado)>0?" ✎":""}</span>:"—"}</td><td style={{padding:"8px 10px"}}><span style={badge(sc[a.estado]||"#64748B")}>{a.estado}</span></td><td style={{padding:"8px 10px",textAlign:"center"}}><button onClick={()=>open(a)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><Edit size={15} color="#64748B"/></button><button onClick={()=>toggleEstado(a)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{a.estado==="activo"?<X size={15} color="#DC2626"/>:<Check size={15} color="#059669"/>}</button></td></tr>);})}</tbody></table></div>)}</div>
    {modal&&<Modal title={modal==="new"?"Matricular alumno":"Editar alumno"} onClose={()=>setModal(null)} onSave={sv} wide><div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}><div><h4 style={{fontSize:13,fontWeight:700,color:"#F97316",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6}}><Users size={15}/>Alumno</h4><Field label="Nombre *" value={form.nombre} onChange={v=>setForm({...form,nombre:v})}/><Field label="Teléfono" value={form.telefono} onChange={v=>setForm({...form,telefono:v})}/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})} type="email"/><div style={{marginBottom:12}}><label style={label}>Sección</label><select value={form.seccion_id} onChange={e=>setForm({...form,seccion_id:e.target.value})} style={{...input,cursor:"pointer"}}><option value="">Sin sección</option>{data.secciones.map(s=><option key={s.id} value={s.id}>{s.nombre} — L {s.mensualidad}</option>)}</select></div><div style={{marginBottom:12}}><label style={label}>Monto mensual</label>{form.seccion_id&&<div style={{fontSize:11,color:"#64748B",marginBottom:4}}>Precio del grupo: L {Number(data.secciones.find(s=>s.id===form.seccion_id)?.mensualidad||0).toLocaleString()}</div>}<input type="number" value={form.monto_personalizado} onChange={e=>setForm({...form,monto_personalizado:e.target.value})} placeholder="Dejar vacío = precio del grupo" style={input}/><div style={{fontSize:11,color:"#94A3B8",marginTop:3}}>Llenar solo si tiene descuento o precio especial.</div></div></div><div><h4 style={{fontSize:13,fontWeight:700,color:"#2563EB",margin:"0 0 12px",display:"flex",alignItems:"center",gap:6}}><Users size={15}/>Padre/Encargado</h4><Field label="Nombre *" value={form.padre_nombre} onChange={v=>setForm({...form,padre_nombre:v})}/><Field label="Teléfono" value={form.padre_telefono} onChange={v=>setForm({...form,padre_telefono:v})}/><Field label="Email" value={form.padre_email} onChange={v=>setForm({...form,padre_email:v})} type="email"/></div></div></Modal>}
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
    const mora=calcMora(f);
    const dataUrl=generarImgFactura(f,al,padre,sec,mora,tipo);
    setImgPreview({dataUrl,phone:padre?.telefono||"",destinatario:padre?.nombre||al?.nombre||"",numero:f.numero_factura});
  };

  const openComp=(cobro=null)=>{if(cobro){const mora=calcMora(cobro);setForm({alumno_id:cobro.alumno_id,cobro_id:cobro.id,fecha_pago:new Date().toISOString().split("T")[0],mes_correspondiente:cobro.mes_correspondiente,monto_total:String((Number(cobro.saldo)>0?Number(cobro.saldo):Number(cobro.monto_total)+mora)),tipo_pago:"efectivo",notas:""});}else{setForm({alumno_id:"",fecha_pago:new Date().toISOString().split("T")[0],mes_correspondiente:MESES[new Date().getMonth()],monto_total:"",tipo_pago:"efectivo",notas:"",cobro_id:""});}setModal("comprobante");};

  const crearCobrosSeccion = async () => {
    if(!bulkSec){showToast("Selecciona una sección","error");return;}
    const mes = form.mes_correspondiente || MESES[new Date().getMonth()];
    const sec = data.secciones.find(s=>s.id===bulkSec);
    if(!sec){showToast("Sección no encontrada","error");return;}
    const alumnosSec = data.alumnos.filter(a=>a.seccion_id===bulkSec && a.estado==="activo");
    if(alumnosSec.length===0){showToast("No hay alumnos activos en esta sección","error");return;}
    const yaConCobro = data.facturas.filter(f=>(f.tipo_factura||"cobro")==="cobro"&&f.mes_correspondiente===mes&&f.estado!=="anulada").map(f=>f.alumno_id);
    const sinCobro = alumnosSec.filter(a=>!yaConCobro.includes(a.id));
    if(sinCobro.length===0){showToast(`Todos ya tienen cobro de ${mes}`,"error");return;}
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
        <tbody>{[...cobros].reverse().map(f=>{const al=data.alumnos.find(a=>a.id===f.alumno_id);const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;const sec=al?data.secciones.find(s=>s.id===al.seccion_id):null;const mora=calcMora(f);const tot=Number(f.monto_total)+mora;const cols={pagada:"#059669",pendiente:"#DC2626",parcial:"#D97706",anulada:"#64748B"};const isP=f.estado==="pendiente"||f.estado==="parcial";return(
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
            const mes=form.mes_correspondiente||MESES[new Date().getMonth()];
            const yaTienen=data.facturas.filter(f=>(f.tipo_factura||"cobro")==="cobro"&&f.mes_correspondiente===mes&&f.estado!=="anulada").map(f=>f.alumno_id);
            const nuevos=als.filter(a=>!yaTienen.includes(a.id));
            return(<div style={{background:"#F0FDF4",borderRadius:8,padding:14,fontSize:12,border:"1px solid #BBF7D0"}}>
              <div style={{fontWeight:700,color:"#166534",marginBottom:8}}>Resumen:</div>
              <div>📚 {sec?.nombre} — L {Number(sec?.mensualidad).toLocaleString()}</div>
              <div>👥 Alumnos activos: {als.length}</div>
              <div>✅ Ya con cobro de {mes}: {als.length-nuevos.length}</div>
              <div style={{marginTop:8,padding:"8px 10px",background:"#fff",borderRadius:6,fontWeight:700,color:"#059669",fontSize:14}}>📝 Se crearán: {nuevos.length} cobros</div>
              {nuevos.length>0&&<div style={{marginTop:8,fontSize:11,color:"#475569"}}>{nuevos.map(a=>{const m=(Number(a.monto_personalizado)>0)?Number(a.monto_personalizado):Number(sec?.mensualidad);return`${a.nombre} (L ${m.toLocaleString()})`;}).join(", ")}</div>}
            </div>);
          })()}
          {!bulkSec&&<div style={{background:"#F8FAFC",borderRadius:8,padding:20,textAlign:"center",color:"#94A3B8",fontSize:13}}>Selecciona una sección</div>}
        </div>
      </div>
    </Modal>}

    {modal==="comprobante"&&<Modal title="✅ Confirmar pago" onClose={()=>setModal(null)} onSave={saveComp} wide><div style={{display:"grid",gridTemplateColumns:window.innerWidth>500?"1fr 1fr":"1fr",gap:16}}><div>
      {!form.cobro_id&&<div style={{marginBottom:12}}><label style={label}>Cobro pendiente *</label><select onChange={e=>{const c=pendCobros.find(c=>c.id===e.target.value);if(c)openComp(c);}} style={{...input,cursor:"pointer"}}><option value="">Seleccionar...</option>{pendCobros.map(c=>{const al=data.alumnos.find(a=>a.id===c.alumno_id);return<option key={c.id} value={c.id}>{c.numero_factura} — {al?.nombre} — {c.mes_correspondiente}</option>;})}</select></div>}
      {form.cobro_id&&(()=>{const cobro=data.facturas.find(f=>f.id===form.cobro_id);const al=data.alumnos.find(a=>a.id===form.alumno_id);const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;const mora=cobro?calcMora(cobro):0;return(<div style={{background:"#F0FDF4",borderRadius:8,padding:12,marginBottom:12,fontSize:12,border:"1px solid #BBF7D0"}}><div style={{fontWeight:700,color:"#166534",marginBottom:4}}>✓ {cobro?.numero_factura}</div><div><strong>Alumno:</strong> {al?.nombre} | <strong>Padre:</strong> {p?.nombre}</div><div><strong>Monto:</strong> L {Number(cobro?.monto_total).toLocaleString()}</div>{mora>0&&<div style={{color:"#DC2626",fontWeight:700}}>⚠️ Mora: L {mora}</div>}</div>);})()}
    </div><div><div style={{marginBottom:12}}><label style={label}>Fecha de pago</label><input type="date" value={form.fecha_pago} onChange={e=>setForm({...form,fecha_pago:e.target.value})} style={input}/></div><Field label="Monto recibido (L)" value={form.monto_total} onChange={v=>setForm({...form,monto_total:v})} type="number"/><div style={{marginBottom:12}}><label style={label}>Tipo de pago</label><select value={form.tipo_pago} onChange={e=>setForm({...form,tipo_pago:e.target.value})} style={{...input,cursor:"pointer"}}>{TIPOS_PAGO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div><Field label="Notas" value={form.notas} onChange={v=>setForm({...form,notas:v})} multiline/></div></div></Modal>}

    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
    {viewInv&&<InvoiceView invoice={viewInv} data={data} onClose={()=>setViewInv(null)} onImagen={mostrarImagen}/>}
  </div>);
}

// ── PREVIEW DE IMAGEN (reutilizable) ──
function ImgPreviewModal({img,onClose}){
  const[copiado,setCopiado]=useState(false);
  const num = telWA(img.phone);

  // Copia la imagen al portapapeles y abre el chat del padre en la app de WhatsApp
  const abrirChat = async () => {
    try{
      const resp = await fetch(img.dataUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      setCopiado(true);
    }catch(e){ /* si el navegador no deja copiar, igual abre el chat */ }
    abrirWhatsApp(img.phone);
  };

  // Menú de compartir del celular (adjunta la imagen directo)
  const compartir = async () => {
    try{
      const resp = await fetch(img.dataUrl);
      const blob = await resp.blob();
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

      {copiado && <div style={{background:"#ECFDF5",border:"1px solid #059669",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#059669",marginBottom:10,fontWeight:600}}>
        ✓ Imagen copiada. En el chat que se abrió, pega con <strong>Ctrl+V</strong> y dale Enter.
      </div>}

      <div style={{background:"#FEF3C7",borderRadius:8,padding:10,fontSize:12,color:"#92400E",marginBottom:12}}>
        <strong>💻 En computadora (con WhatsApp instalado):</strong> toca "Abrir chat" → se abre la conversación del padre y la imagen queda copiada → pega con <strong>Ctrl+V</strong> → Enter.<br/>
        <strong>📱 En celular:</strong> usa "Compartir imagen" → elige WhatsApp → elige el contacto.
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {num && <button onClick={abrirChat} style={btn("#25D366")}><Phone size={14}/>Abrir chat de {img.destinatario?.split(" ")[0]||"WhatsApp"}</button>}
        <button onClick={compartir} style={btn("#7C3AED")}><Send size={14}/>Compartir imagen</button>
        <button onClick={()=>{const a=document.createElement('a');a.download=`${img.numero}.png`;a.href=img.dataUrl;a.click();}} style={btn("#2563EB")}><Download size={14}/>Descargar</button>
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
  const f=invoice;const al=data.alumnos.find(a=>a.id===f.alumno_id);const padre=al?data.padres.find(p=>p.id===al.padre_id):null;const sec=al?data.secciones.find(s=>s.id===al.seccion_id):null;const mora=calcMora(f);
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
function HistorialPage({data,showToast}){
  const[selSec,setSelSec]=useState("");const[selAl,setSelAl]=useState("");
  const[imgPreview,setImgPreview]=useState(null);
  const als=data.alumnos.filter(a=>!selSec||a.seccion_id===selSec);
  const alumno=selAl?data.alumnos.find(a=>a.id===selAl):null;
  const padre=alumno?data.padres.find(p=>p.id===alumno.padre_id):null;
  const sec=alumno?data.secciones.find(s=>s.id===alumno.seccion_id):null;

  const verImagen = (f, tipo) => {
    const al=data.alumnos.find(a=>a.id===f.alumno_id);
    const p=al?data.padres.find(pp=>pp.id===al.padre_id):null;
    const s=al?data.secciones.find(ss=>ss.id===al.seccion_id):null;
    const mora=calcMora(f);
    const dataUrl=generarImgFactura(f,al,p,s,mora,tipo);
    setImgPreview({dataUrl,phone:p?.telefono||"",destinatario:p?.nombre||al?.nombre||"",numero:f.numero_factura});
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
          <div style={{fontSize:20,fontWeight:800,color:"#F97316"}}>L {monto.toLocaleString()}</div>
          {Number(alumno.monto_personalizado)>0&&<div style={{fontSize:11,color:"#7C3AED"}}>Precio especial ✎</div>}
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
              return(<tr key={mes} style={{borderBottom:"1px solid #F1F5F9",background:esFuturo?"#F8FAFC":"transparent"}}>
                <td style={{padding:"8px 10px",fontWeight:700,color:esFuturo?"#94A3B8":"#1E293B"}}>{mes.slice(0,3)}</td>
                <td style={{padding:"8px 10px"}}>
                  {cobro?(<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={badge(cobro.estado==="pagada"?"#059669":cobro.estado==="pendiente"?"#DC2626":"#D97706")}>{cobro.numero_factura} · {cobro.estado}</span>
                    <span style={{fontSize:11,color:"#475569"}}>L {Number(cobro.monto_total).toLocaleString()}</span>
                    <button onClick={()=>verImagen(cobro,"cobro")} style={{background:"#2563EB",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4}}><Send size={10} color="#fff"/></button>
                  </div>):(<span style={{color:esFuturo?"#D1D5DB":"#DC2626",fontSize:11}}>{esFuturo?"—":"Sin cobro"}</span>)}
                </td>
                <td style={{padding:"8px 10px"}}>
                  {comp?(<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={badge("#059669")}>{comp.numero_factura} · ✓ Pagado</span>
                    <span style={{fontSize:11,color:"#475569"}}>{comp.fecha_pago} · {comp.tipo_pago}</span>
                    <button onClick={()=>verImagen(comp,"comprobante")} style={{background:"#059669",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4}}><Send size={10} color="#fff"/></button>
                  </div>):(<span style={{color:"#D1D5DB",fontSize:11}}>—</span>)}
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
    {!selAl&&<div style={card}><h3 style={{fontSize:14,fontWeight:700,color:"#1E293B",margin:"0 0 8px"}}>Selecciona un alumno</h3><p style={{fontSize:13,color:"#94A3B8"}}>Filtra por sección y selecciona el alumno para ver su tabla de cobros y comprobantes mes por mes, con botones para reenviar cada imagen.</p></div>}
    {imgPreview&&<ImgPreviewModal img={imgPreview} onClose={()=>setImgPreview(null)}/>}
  </div>);
}

// ── RECORDATORIOS ──
function RecordatoriosPage({data,showToast}){
  const[selSec,setSelSec]=useState("");const[enviando,setEnviando]=useState(false);const[enviados,setEnviados]=useState([]);
  const[mensaje,setMensaje]=useState("Estimado padre de familia, le recordamos que la mensualidad de {mes} está pendiente (L {monto}). Favor enviar comprobante de pago. Seeds English School 🌱");
  const mes=MESES[new Date().getMonth()];
  const contactos=(selSec?data.alumnos.filter(a=>a.seccion_id===selSec&&a.estado==="activo"):data.alumnos.filter(a=>a.estado==="activo")).filter(al=>!data.facturas.some(f=>f.alumno_id===al.id&&f.mes_correspondiente===mes&&f.estado==="pagada"&&(f.tipo_factura||"cobro")==="cobro")).map(al=>{const p=data.padres.find(p=>p.id===al.padre_id);const sec=data.secciones.find(s=>s.id===al.seccion_id);const cobro=data.facturas.find(f=>f.alumno_id===al.id&&f.mes_correspondiente===mes&&(f.tipo_factura||"cobro")==="cobro");const mora=cobro?calcMora(cobro):0;const base=(Number(al.monto_personalizado)>0)?Number(al.monto_personalizado):Number(sec?.mensualidad)||0;return{alumno_id:al.id,alumno:al.nombre,padre:p?.nombre,telefono:p?.telefono,email:p?.email,seccion:sec?.nombre,monto:base+mora,mora};});
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
    const backup={fecha:new Date().toISOString(),version:2,...data};
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
      for(const table of ["secciones","maestros","padres","alumnos","facturas","gastos"]){
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

// ── COMPONENTES ──
function Modal({title,onClose,onSave,children,wide}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}><div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:wide?640:440,maxHeight:"90vh",overflow:"auto"}}><div style={{padding:"16px 20px",borderBottom:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontSize:15,fontWeight:700,margin:0,color:"#1E293B"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} color="#64748B"/></button></div><div style={{padding:20}}>{children}</div><div style={{padding:"0 20px 16px",display:"flex",justifyContent:"flex-end",gap:10}}><button onClick={onClose} style={btnO}>Cancelar</button><button onClick={onSave} style={btn()}>Guardar</button></div></div></div>);
}
function Field({label:lbl,value,onChange,type="text",placeholder,multiline}){
  return(<div style={{marginBottom:12}}><label style={label}>{lbl}</label>{multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{...input,resize:"vertical"}}/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={input}/>}</div>);
}
