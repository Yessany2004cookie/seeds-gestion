-- Deshace supabase/desercion_encuestas.sql (borra las encuestas guardadas y la fecha de baja).
drop trigger if exists trg_alumno_baja_encuesta on public.alumnos;
drop function if exists public.alumno_baja_encuesta();
drop function if exists public.encuesta_ver(text);
drop function if exists public.encuesta_responder(text, text, int, text, text);
drop table if exists public.encuestas_desercion;
alter table public.alumnos drop column if exists fecha_baja;
-- Respaldo de alumnos antes del cambio: esquema respaldo_20261125_desercion.alumnos
