import { createClient } from '@supabase/supabase-js';

// Sostituisci questi valori con le chiavi reali del tuo progetto Supabase
const SUPABASE_URL = 'https://xokcvmuvkobpgxolqnjt.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhva2N2bXV2a29icGd4b2xxbmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzY4MTEsImV4cCI6MjEwMDMxMjgxMX0.tDPmVnXfdvNTd17UG2-ajbUwjTQesvQtYg47BSfrVfQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
