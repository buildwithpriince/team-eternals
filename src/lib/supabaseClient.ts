/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__) ||
  'https://owlrokravkwkptmsogai.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bHJva3Jhdmt3a3B0bXNvZ2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTA0NDQsImV4cCI6MjEwMzg2NjQ0NH0.bacva8aFySpOAqvguQ7NsEy1CObyiTBJIEjeRfqHrXU';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
