import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type TelemetryEventType = 'search' | 'view_ad' | 'click_ad' | 'view_store' | 'add_to_cart' | 'checkout_start';

export const useMarketTelemetry = () => {
  // Session ID para atrelar a navegação de um mesmo visitante
  const sessionId = useRef<string>('');

  useEffect(() => {
    // Busca ou cria uma sessão anônima armazenada no localstorage
    let storedSession = localStorage.getItem('market_telemetry_session');
    if (!storedSession) {
      storedSession = crypto.randomUUID();
      localStorage.setItem('market_telemetry_session', storedSession);
    }
    sessionId.current = storedSession;
  }, []);

  /**
   * Envia evento para a telemetria silenciosamente em background.
   */
  const trackEvent = useCallback(async (
    eventType: TelemetryEventType,
    targetId: string, // Pode ser o ID do anúncio, ID da loja, ou termo de pesquisa
    workspaceId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!sessionId.current) return;

    try {
      // Ignora métricas se for o próprio dono testando a loja dele com a mesma conta logada
      // Para evitar poluir os dados da IA com cliques do proprietário.
      const loggedUser = localStorage.getItem('logged_user');
      let userId = null;
      if (loggedUser) {
        const u = JSON.parse(loggedUser);
        // We do not use u.id as customer_id because customer_id is linked to auth.users, and u.id is public.users
        // We will try to fetch from Supabase auth
        if (workspaceId && u.workspaceId === workspaceId) {
           return; // Don't track owner's interactions with own store
        }
      }

      // Try to get supabase auth user
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }

      const payload = {
        session_id: sessionId.current,
        customer_id: userId,
        event_type: eventType,
        target_id: targetId,
        workspace_id: workspaceId || null,
        metadata: metadata || {}
      };

      // Dispara em background via Supabase
      supabase.from('market_telemetry').insert(payload).then(({ error }) => {
        if (error) console.error('[Telemetry] Sync falhou:', error.message);
      }).catch(e => console.error('[Telemetry] Fetch falhou:', e));

    } catch (e) {
      console.error('[Telemetry] Erro ao disparar métrica:', e);
    }
  }, []);

  return { trackEvent, sessionId: sessionId.current };
};
