
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvxvwntjwjzalzjiwrmm.supabase.co';
const supabaseAnonKey = 'sb_publishable_xRQhm9rvVA2FTQUxgP8uDQ_Nwx4LwFQ'; 

console.log('[DEBUG_SUPABASE] Initializing Supabase client...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { 
    headers: { 'x-application-name': 'salgados-pro-v3' },
  },
  db: { schema: 'public' }
});

console.log('[DEBUG_SUPABASE] Client initialized successfully');

export function withTimeout<T>(promise: Promise<T>, timeoutMs = 90000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error("O servidor demorou muito para responder. Tentaremos novamente.");
      (err as any).code = 'TIMEOUT_PROMISE';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
}

export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  return (
    error instanceof TypeError || 
    msg.includes('fetch') || 
    msg.includes('network') || 
    msg.includes('load failed') ||
    msg.includes('cors') ||
    msg.includes('net::err_blocked_by_client') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection refused')
  );
};

export const isTimeoutError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = (error.message || String(error)).toLowerCase();
  return (
    code === '57014' || 
    code === 'PGRST103' || 
    code === 'TIMEOUT_PROMISE' ||
    msg.includes('timeout') || 
    msg.includes('deadline exceeded') ||
    msg.includes('abort')
  );
};

export const safeStringifyError = (error: any): string => {
  if (!error) return "Erro inesperado";
  if (isNetworkError(error)) return "Conexão Instável: Verifique sua internet.";
  if (isTimeoutError(error)) return "Sincronizando: O servidor está processando seus dados, aguarde um momento.";
  
  if (typeof error === 'object') {
    if (error.message) return error.message;
    if (error.details) return error.details;
    if (error.hint) return `${error.message} (Dica: ${error.hint})`;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  
  if (error.code === '23505') return "Registro Duplicado: Este item já existe.";
  if (error.status === 500) return "Ajustando Servidor: Estamos estabilizando a conexão.";
  
  return String(error);
};

export async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.status === 500 || error.status === 502 || error.status === 503 || isNetworkError(error) || isTimeoutError(error);
    if (isRetryable && retries > 0) {
      console.warn(`Nexus Resilience: Tentativa de reconexão em ${delay}ms... (${retries} restantes)`);
      await new Promise(res => setTimeout(res, delay));
      // Exponential backoff
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const checkDatabaseHealth = async () => {
  try {
    console.log('[DEBUG_SUPABASE] Checking DB Health...');
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    console.log('[DEBUG_SUPABASE] DB Health OK');
    return { ok: true };
  } catch (e: any) {
    console.error('[DEBUG_SUPABASE] DB Health FAIL:', e);
    return { ok: false, error: e };
  }
};
