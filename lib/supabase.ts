import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvxvwntjwjzalzjiwrmm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eHZ3bnRqd2p6YWx6aml3cm1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTkyMjcsImV4cCI6MjA4MTY3NTIyN30.HrjArI3Mq5dvsYhQXTJw-cL691J7QMhj9ixh6mzz6sI'; 

console.log('[DEBUG_SUPABASE] Initializing Supabase client...');

const resilientFetch = async (input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response> => {
  let attempts = 0;
  const maxAttempts = 6; 
  
  // Extrai a URL para log, lidando com Request objects
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  }
  
  while (attempts < maxAttempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // Aumentado para 90s
    
    try {
      let currentInput = input;
      if (input instanceof Request && attempts > 0) {
        try {
          currentInput = input.clone();
        } catch (cloneErr) {
          console.warn("[Supabase Fetch] Não foi possível clonar o Request para retry.");
        }
      }

      const response = await fetch(currentInput, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (url.includes('auth/v1/token') && response.status === 400) {
         console.warn("[Supabase Auth] Refresh token inválido. Limpando sessão...");
         const projectRef = supabaseUrl.split('//')[1].split('.')[0];
         localStorage.removeItem('supabase-auth-token');
         localStorage.removeItem(`sb-${projectRef}-auth-token`);
         localStorage.removeItem('logged_user');
      } else if (response.status === 401 || response.status === 403) {
         try {
           const cloned = response.clone();
           const text = await cloned.text();
           if (text.includes('InvalidJWTToken') || text.includes('expired')) {
             console.warn("[Supabase Auth] JWT Expirado ou Inválido. Forçando logout...");
             const projectRef = supabaseUrl.split('//')[1].split('.')[0];
             localStorage.removeItem('supabase-auth-token');
             localStorage.removeItem(`sb-${projectRef}-auth-token`);
             localStorage.removeItem('logged_user');
             if (typeof window !== 'undefined') window.location.reload();
           }
         } catch(e) {}
      }
      
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = (err?.message || String(err)).toLowerCase();
      const errName = err?.name || 'Error';
      
      const isAbort = err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
      const isNetwork = msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('load failed') || msg.includes('net::err') || msg.includes('dns') || msg.includes('connection refused') || msg.includes('inacessível');
      
      if (isAbort || isNetwork) {
        if (url.includes('refresh_token')) {
           console.warn("[Supabase Auth] Falha de rede no refresh token. Limpando sessão local.");
           const projectRef = supabaseUrl.split('//')[1].split('.')[0];
           localStorage.removeItem('supabase-auth-token');
           localStorage.removeItem(`sb-${projectRef}-auth-token`);
           localStorage.removeItem('logged_user');
           throw err; 
        }

        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`[Supabase Fetch Failure] URL: ${url} | Name: ${errName} | Msg: ${err.message}`);
          let reason = "Conexão Interrompida: O navegador não conseguiu completar a chamada.";
          if (isAbort) reason = "Tempo Limite: O servidor demorou demais para responder (>90s).";
          
          const customErr = new Error(`${reason}
          
DICAS:
1. Verifique sua internet ou mude do Wi-Fi para os Dados Móveis.
2. O servidor Supabase (${url}) pode estar em manutenção ou hibernação profunda.`);

          (customErr as any).code = isAbort ? 'TIMEOUT_FETCH' : 'NETWORK_ERROR';
          (customErr as any).status = 0;
          (customErr as any).url = url;
          (customErr as any).originalError = err;
          throw customErr;
        } else {
          // Log de aviso apenas para tentativas intermediárias
          console.warn(`[Supabase Resilience] Tentativa ${attempts}/${maxAttempts} falhou para URL: ${url}. Retentando...`);
        }
        
        const delay = 3000 * attempts;
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      } else {
        // Erros que não são de rede ou timeout (ex: TypeError por código errado)
        console.error(`[Supabase Fetch Error Unrecoverable] URL: ${url} | Name: ${errName} | Msg: ${err.message}`);
        throw err;
      }
    }
  }
  throw new Error("Erro de Conexão Crítico.");
};

// Validação básica de Sanidade das chaves
if (supabaseAnonKey.length < 50 && !supabaseUrl.includes('localhost')) {
  console.error('!!! AVISO CRÍTICO: Chave Anon do Supabase parece ser curta demais ou inválida. Verifique sua configuração !!!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { 
    headers: { 'x-application-name': 'salgados-pro-v3' },
    fetch: resilientFetch
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
  
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('connection refused') ||
    msg.includes('net::err') ||
    msg.includes('cors') ||
    msg.includes('offline or inacessível') ||
    msg.includes('verifique sua conexão') ||
    msg.includes('servidor está online') ||
    msg.includes('inacessível')
  ) {
    return true;
  }
  
  // Apenas TypeError relacionado a fetch deve ser considerado erro de rede
  if (error instanceof TypeError && (msg.includes('fetch') || msg.includes('network'))) {
    return true;
  }
  
  return false;
};

export const isTimeoutError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = (error.message || String(error)).toLowerCase();
  return (
    code === '57014' || 
    code === 'PGRST103' || 
    code === 'TIMEOUT_PROMISE' ||
    code === 'TIMEOUT_FETCH' ||
    msg.includes('tempo esgotado') ||
    msg.includes('timeout') || 
    msg.includes('deadline exceeded') ||
    msg.includes('abort') ||
    msg.includes('demorando muito')
  );
};

export const safeStringifyError = (error: any): string => {
  if (error === null || error === undefined) return "Erro desconhecido";
  
  // Prioriza mensagens customizadas do Nexus/ResilientFetch
  if (error instanceof Error && ((error as any).code === 'NETWORK_ERROR' || (error as any).code === 'TIMEOUT_FETCH')) {
    return error.message;
  }

  if (typeof error === 'string') {
    const low = error.toLowerCase();
    if (low.includes('failed to fetch') || low.includes('network error')) {
      return "Rede Inestável: O servidor está inacessível no momento. Tente novamente em instantes.";
    }
    return error;
  }
  
  if (isNetworkError(error)) return "Problema de Conexão: Seu navegador não conseguiu falar com o servidor. Isso geralmente é bloqueio de Wi-Fi, DNS ou o servidor está em hibernação profunda. Tente usar Dados Móveis.";
  if (isTimeoutError(error)) return "Tempo Esgotado: O servidor demorou mais de 60 segundos para responder. Clique em Limpar Sessão ou tente mais tarde.";

  // Handle native JS Error objects with recursive cause check
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) return "Falha de Rede: Não foi possível carregar os dados. Verifique seu Wi-Fi/DNS ou mude para Dados Móveis.";
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

export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Se o erro for do resilientFetch (Network Exception), aqui damos uma última chance se retries > 0
    const isAuthError = error.status >= 400 && error.status < 500 && error.status !== 429;
    
    // Permitimos o retry de NETWORK_ERROR se ainda houverem tentativas, pois o delay maior do withRetry pode ajudar
    const isRetryable = (error.status === 500 || error.status === 502 || error.status === 503 || error.status === 429 || isNetworkError(error) || isTimeoutError(error)) && !isAuthError;
    
    if (isRetryable && retries > 0) {
      console.warn(`Nexus Resilience: Tentando reconexão em ${delay}ms... (${retries} restantes)`);
      await new Promise(res => setTimeout(res, delay));
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

export const checkDatabaseHealth = async (timeout = 30000, maxAttempts = 3) => {
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
        if (isTimeoutError(e)) {
          console.warn('[DEBUG_SUPABASE] DB Health Timeout:', msg);
        } else {
          console.error('[DEBUG_SUPABASE] DB Health FAIL:', msg);
        }
        return { ok: false, error: e };
      }
      
      // Exponential backoff for health check (2s, 4s, 8s)
      await new Promise(res => setTimeout(res, 2000 * attempts));
    }
  }
  return { ok: false };
};