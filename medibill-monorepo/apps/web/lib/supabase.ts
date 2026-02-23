import { createClient } from '@supabase/supabase-js';

// Validamos que las variables de entorno existan
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Creamos y exportamos el cliente
export const supabase = createClient(supabaseUrl, supabaseKey);