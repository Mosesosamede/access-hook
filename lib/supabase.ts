import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

let browserClient: any = null;

const createMockSupabaseClient = () => {
  const noopQuery: any = {
    select: () => noopQuery,
    insert: () => noopQuery,
    update: () => noopQuery,
    delete: () => noopQuery,
    eq: () => noopQuery,
    neq: () => noopQuery,
    gt: () => noopQuery,
    gte: () => noopQuery,
    lt: () => noopQuery,
    lte: () => noopQuery,
    like: () => noopQuery,
    ilike: () => noopQuery,
    is: () => noopQuery,
    in: () => noopQuery,
    contains: () => noopQuery,
    containedBy: () => noopQuery,
    range: () => noopQuery,
    textSearch: () => noopQuery,
    filter: () => noopQuery,
    order: () => noopQuery,
    limit: () => noopQuery,
    offset: () => noopQuery,
    single: async () => ({ data: null, error: { message: 'Supabase not configured (mock mode)' } }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  return {
    from: () => noopQuery,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signUp: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      updateUser: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      exchangeCodeForSession: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'Storage not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
};

export const getSupabase = () => {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn('Supabase env vars not configured — using mock client');
    browserClient = createMockSupabaseClient();
    return browserClient;
  }

  const sanitizedUrl = url.replace(/\/$/, '');
  const sanitizedAnonKey = anonKey.trim();
  browserClient = createBrowserClient(sanitizedUrl, sanitizedAnonKey);
  return browserClient;
};

export const getServerSupabase = (cookieStore: any) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return createMockSupabaseClient() as any;
  }

  const sanitizedUrl = url.replace(/\/$/, '');
  const sanitizedAnonKey = anonKey.trim();

  return createServerClient(sanitizedUrl, sanitizedAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any) {
        try {
          cookiesToSet.forEach(({ name, value, options }: any) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });
};

export const getServiceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return createMockSupabaseClient() as any;
  }

  return createClient(
    url.replace(/\/$/, ''),
    serviceKey.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};


