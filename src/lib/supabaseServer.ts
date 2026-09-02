import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client with full service role permissions for backend operations
let supabaseServerInstance: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (!supabaseServerInstance) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && serviceRoleKey) {
      supabaseServerInstance = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }
  return supabaseServerInstance;
}

// Auto-initialize storage bucket "documents" and verify database connectivity
export async function initializeSupabaseBackend() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[Supabase Server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  try {
    // Ensure "documents" bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (!listError) {
      const hasDocsBucket = buckets?.some((b) => b.name === 'documents' || b.id === 'documents');
      if (!hasDocsBucket) {
        const { error: createError } = await supabase.storage.createBucket('documents', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        if (createError) {
          console.warn('[Supabase Server] Notice creating documents bucket:', createError.message);
        } else {
          console.log('[Supabase Server] "documents" storage bucket created successfully');
        }
      }
    }
    console.log('[Supabase Server] Initialized and connected successfully');
  } catch (err) {
    console.warn('[Supabase Server] Init check error:', err);
  }
}
