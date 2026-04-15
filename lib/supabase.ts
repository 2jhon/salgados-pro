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

export const registerStockMovement = async (movement: import('../types').StockMovement) => {
  try {
    const { error } = await supabase.from('stock_movements').insert([movement]);
    if (error) {
      console.error('Error registering stock movement:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to register stock movement:', err);
    return false;
  }
};

console.log('[DEBUG_SUPABASE] Client initialized successfully');

export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 90000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error("Tempo limite da operação excedido.");
      (err as any).code = 'TIMEOUT_PROMISE';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([
    Promise.resolve(promise).then(
      (val) => { clearTimeout(timeoutId); return val; },
      (err) => { clearTimeout(timeoutId); throw err; }
    ),
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
  if (error === null || error === undefined) return "Erro desconhecido";
  if (typeof error === 'string') return error;
  
  if (isNetworkError(error)) return "Erro de Conexão: Verifique sua internet.";
  if (isTimeoutError(error)) return "Tempo Esgotado: O servidor demorou a responder.";

  // Handle native JS Error objects with recursive cause check
  if (error instanceof Error) {
    const cause = (error as any).cause;
    const causeStr = cause ? ` (Causa: ${safeStringifyError(cause)})` : '';
    return `${error.name}: ${error.message}${causeStr}`;
  }

  if (typeof error === 'object') {
    // Tenta extrair mensagem de erro padrão do Supabase/Postgrest
    let message = error.message || error.msg || error.error_description || error.description;
    const details = error.details || error.hint;
    const code = error.code;
    
    // If message is an object, recurse
    if (message && typeof message === 'object') {
      message = safeStringifyError(message);
    }
    
    if (message) {
      return `${code ? `[${code}] ` : ''}${message}${details ? ` (${details})` : ''}`;
    }
    
    // Se não tiver mensagem, tenta JSON com proteção circular
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(error, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
      
      if (json && json !== '{}' && json !== '[]') return json;
    } catch {}
    
    // Fallback if object is empty or stringify fails
    try {
        if (error.toString && error.toString !== Object.prototype.toString) {
           return error.toString();
        }
        
        // If it's a plain object with no useful keys or toString
        const keys = Object.keys(error);
        if (keys.length > 0) {
            return `Objeto desconhecido: { ${keys.join(', ')} }`;
        }

        const str = String(error);
        return str === '[object Object]' ? "Erro desconhecido (Objeto não serializável)" : str;
    } catch {
        return "Erro não serializável";
    }
  }
  
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

export const upsertInventory = async (workspaceId: string, sectionId: string, itemId: string, quantity: number, minStock?: number) => {
  try {
    const payload: any = {
      workspace_id: workspaceId,
      section_id: sectionId,
      item_id: itemId,
      quantity: quantity,
      updated_at: new Date().toISOString()
    };
    if (minStock !== undefined) {
      payload.min_stock = minStock;
    }
    
    const { error } = await supabase
      .from('inventory')
      .upsert(payload, { onConflict: 'workspace_id, section_id, item_id' });
      
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error upserting inventory:', err);
    return false;
  }
};

export const checkDatabaseHealth = async (timeout = 25000, maxAttempts = 3) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`[DEBUG_SUPABASE] Checking DB Health (Attempt ${attempts + 1})...`);
      
      const result = await withTimeout(
        supabase.from('users').select('id').limit(1), 
        timeout 
      ) as any;
      
      const { error } = result;
      
      if (error) {
        const code = String(error.code || '');
        if (code === 'PGRST301' || code === '401' || code === '403' || code === 'PGRST116') {
          console.warn('[DEBUG_SUPABASE] DB Connected but restricted (Health OK)');
          return { ok: true };
        }
        // Retry on 5xx or network errors
        if (isNetworkError(error) || isTimeoutError(error) || (error as any).status >= 500) {
           throw error; 
        }
        throw error;
      }
      
      console.log('[DEBUG_SUPABASE] DB Health OK');
      return { ok: true };
    } catch (e: any) {
      attempts++;
      console.warn(`[DEBUG_SUPABASE] Health check attempt ${attempts} failed:`, e.message || e);
      
      if (attempts >= maxAttempts) {
        const msg = safeStringifyError(e);
        console.error('[DEBUG_SUPABASE] DB Health FAIL:', msg);
        return { ok: false, error: e };
      }
      
      // Exponential backoff for health check (2s, 4s, 8s)
      await new Promise(res => setTimeout(res, 2000 * attempts));
    }
  }
  return { ok: false };
};