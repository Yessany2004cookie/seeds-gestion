-- ============================================================
-- SEEDS ENGLISH SCHOOL - Base de Datos v2
-- Ejecutar TODO este archivo en Supabase > SQL Editor > Run
-- ============================================================

-- 1. SECCIONES
create table secciones (
  id text primary key,
  nombre text not null,
  horario text,
  descripcion text,
  mensualidad numeric not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. MAESTROS (secciones_ids como lista JSON para simplicidad)
create table maestros (
  id text primary key,
  nombre text not null,
  telefono text,
  email text,
  salario numeric not null default 0,
  secciones_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. PADRES / ENCARGADOS
create table padres (
  id text primary key,
  nombre text not null,
  telefono text,
  email text,
  created_at timestamptz not null default now()
);

-- 4. ALUMNOS
create table alumnos (
  id text primary key,
  nombre text not null,
  telefono text,
  email text,
  padre_id text not null references padres(id),
  seccion_id text references secciones(id) on delete set null,
  estado text not null default 'activo',
  fecha_ingreso date not null default current_date,
  monto_personalizado numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 5. FACTURAS (cobros y comprobantes)
create table facturas (
  id text primary key,
  numero_factura text not null,
  alumno_id text not null references alumnos(id),
  tipo_factura text not null default 'cobro',
  fecha_emision date not null default current_date,
  fecha_pago date,
  mes_correspondiente text not null,
  monto_total numeric not null default 0,
  abono numeric not null default 0,
  saldo numeric not null default 0,
  tipo_pago text not null default 'efectivo',
  estado text not null default 'pendiente',
  notas text,
  cobro_id text,
  created_at timestamptz not null default now()
);

-- 6. GASTOS (salarios, renta, otros)
create table gastos (
  id text primary key,
  tipo text not null,
  maestro_id text references maestros(id) on delete set null,
  descripcion text,
  monto numeric not null default 0,
  fecha date not null default current_date,
  mes_correspondiente text not null,
  created_at timestamptz not null default now()
);

-- ÍNDICES para rendimiento
create index idx_alumnos_padre on alumnos(padre_id);
create index idx_alumnos_seccion on alumnos(seccion_id);
create index idx_facturas_alumno on facturas(alumno_id);
create index idx_facturas_mes on facturas(mes_correspondiente);
create index idx_facturas_tipo on facturas(tipo_factura);
create index idx_gastos_mes on gastos(mes_correspondiente);
create index idx_gastos_maestro on gastos(maestro_id);

-- ============================================================
-- SEGURIDAD: Row Level Security
-- Solo usuarios autenticados pueden leer/escribir
-- ============================================================
alter table secciones enable row level security;
alter table maestros enable row level security;
alter table padres enable row level security;
alter table alumnos enable row level security;
alter table facturas enable row level security;
alter table gastos enable row level security;

create policy "auth_all_secciones" on secciones for all to authenticated using (true) with check (true);
create policy "auth_all_maestros" on maestros for all to authenticated using (true) with check (true);
create policy "auth_all_padres" on padres for all to authenticated using (true) with check (true);
create policy "auth_all_alumnos" on alumnos for all to authenticated using (true) with check (true);
create policy "auth_all_facturas" on facturas for all to authenticated using (true) with check (true);
create policy "auth_all_gastos" on gastos for all to authenticated using (true) with check (true);
