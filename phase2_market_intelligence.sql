-- FASE 2: MOTOR DE AGREGAÇÃO E INTELIGÊNCIA (VIEWS E ALGORITMO DE SCORING)
-- Este script cria a camada de inteligência que analisa a telemetria bruta
-- e transforma em métricas cruciais de engajamento e preferências.

-- 1. Tabela Materializada de Produtos/Anúncios Em Alta (Trending Items)
-- Computa o Score de cada item no marketplace nos últimos 7 e 30 dias.
-- Pesos do algoritmo: View = 1 pt | Click = 3 pts | Add to Cart = 10 pts | Checkout = 20 pts

CREATE OR REPLACE VIEW public.vw_trending_market_items AS
SELECT 
    target_id AS item_id,
    workspace_id,
    COUNT(*) AS total_interactions,
    COUNT(*) FILTER (WHERE event_type = 'search') AS searches,
    COUNT(*) FILTER (WHERE event_type = 'view_ad' OR event_type = 'view_store') AS views,
    COUNT(*) FILTER (WHERE event_type = 'click_ad') AS clicks,
    COUNT(*) FILTER (WHERE event_type = 'add_to_cart') AS carts,
    COUNT(*) FILTER (WHERE event_type = 'checkout_start') AS checkouts,
    -- Algoritmo de Score
    (
        COUNT(*) FILTER (WHERE event_type = 'view_ad' OR event_type = 'view_store') * 1 +
        COUNT(*) FILTER (WHERE event_type = 'click_ad') * 3 +
        COUNT(*) FILTER (WHERE event_type = 'add_to_cart') * 10 +
        COUNT(*) FILTER (WHERE event_type = 'checkout_start') * 20
    ) AS engine_score
FROM public.market_telemetry
WHERE target_id IS NOT NULL 
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY target_id, workspace_id
ORDER BY engine_score DESC;

-- 2. Tabela de Afinidade de Consumidor (Customer Affinity Model)
-- Mapeia qual perfil de loja ou palavras-chave cada usuário logado ou anônimo busca.
CREATE OR REPLACE VIEW public.vw_customer_affinity AS
SELECT 
    COALESCE(customer_id::text, session_id) AS identity_ref,
    workspace_id,
    COUNT(*) AS interaction_count,
    MAX(created_at) AS last_interaction
FROM public.market_telemetry
WHERE workspace_id IS NOT NULL
GROUP BY COALESCE(customer_id::text, session_id), workspace_id
ORDER BY interaction_count DESC;

-- 3. Tabela de Hot Keywords (Termos mais buscados no motor de busca)
CREATE OR REPLACE VIEW public.vw_hot_search_keywords AS
SELECT 
    LOWER(TRIM(target_id)) AS keyword,
    COUNT(*) AS search_volume,
    COUNT(DISTINCT session_id) AS unique_searchers,
    MAX(created_at) AS last_searched
FROM public.market_telemetry
WHERE event_type = 'search' 
  AND target_id IS NOT NULL 
  AND LENGTH(target_id) > 2
GROUP BY LOWER(TRIM(target_id))
ORDER BY search_volume DESC;

-- OBS: Para produção contínua, uma View Materializada recarregada a cada hora via Cron (pg_cron)
-- poupa muita performance da CPU do Supabase em vez de gerar o Score em tempo de requisição.
