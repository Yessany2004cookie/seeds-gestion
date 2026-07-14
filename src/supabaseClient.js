import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANTE: Reemplaza estos dos valores con los de TU proyecto Supabase
// Los encuentras en: Supabase > Tu proyecto > Settings (engranaje) > API
//
// 1. "Project URL"  → pégalo en SUPABASE_URL
// 2. "anon public"  → pégalo en SUPABASE_ANON_KEY
//
// Nota: la clave "anon" está diseñada para ser pública. La seguridad
// real está en las políticas RLS de la base de datos (solo usuarios
// autenticados pueden leer/escribir).

const SUPABASE_URL = 'https://vmrihjkdlrftkxapajpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcmloamtkbHJmdGt4YXBhanB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNTI5MTksImV4cCI6MjA5OTYyODkxOX0.81aSkiUEJ2sLBm3YUyGGtQx4cZMXNaitqdF2dMX6kJs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
