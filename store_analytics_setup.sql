-- ====================================================================================
-- ETAPA 1: INFRAESTRUTURA DE INTELIGÊNCIA E MÉTRICAS (TELEMETRIA)
-- ====================================================================================

-- 1. Tabela de Visualizações de Loja (Captura acessos à Vitrine)
CREATE TABLE IF NOT EXISTS public.store_analytics_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    customer_id UUID, -- Referência ao public.users.id se logado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Cliques em Produtos (Captura interesse específico)
CREATE TABLE IF NOT EXISTS public.store_analytics_clicks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    customer_id UUID, -- Opcional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.store_analytics_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_analytics_clicks ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança ( store_analytics_views )
DROP POLICY IF EXISTS "Permitir inserção pública de views" ON public.store_analytics_views;
DROP POLICY IF EXISTS "Permitir leitura por donos do workspace views" ON public.store_analytics_views;

CREATE POLICY "Permitir inserção pública de views" 
ON public.store_analytics_views FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir leitura por donos do workspace views" 
ON public.store_analytics_views FOR SELECT 
USING (
    workspace_id IN (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() AND role = 'OWNER')
);

-- 5. Políticas de Segurança ( store_analytics_clicks )
DROP POLICY IF EXISTS "Permitir inserção pública de clicks" ON public.store_analytics_clicks;
DROP POLICY IF EXISTS "Permitir leitura por donos do workspace clicks" ON public.store_analytics_clicks;

CREATE POLICY "Permitir inserção pública de clicks" 
ON public.store_analytics_clicks FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir leitura por donos do workspace clicks" 
ON public.store_analytics_clicks FOR SELECT 
USING (
    workspace_id IN (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() AND role = 'OWNER')
);

-- 6. View de Desempenho Consolidado (BI)
-- Esta view une telemetria anônima com engajamento nominal (seguidores e avaliações)
CREATE OR REPLACE VIEW public.vw_store_analytics_summary AS
SELECT 
    sp.workspace_id,
    COALESCE(v.total_views, 0) as total_views,
    COALESCE(c.total_clicks, 0) as total_clicks,
    COALESCE(f.total_followers, 0) as total_followers,
    COALESCE(fav.total_favorites, 0) as total_favorites,
    COALESCE(r.avg_rating, 0) as avg_rating,
    COALESCE(r.total_ratings, 0) as total_ratings,
    (
        SELECT count(*) 
        FROM public.reports rep 
        WHERE rep.reported_workspace_id = sp.workspace_id AND rep.status = 'PENDING'
    ) as pending_reports
FROM public.store_profiles sp
LEFT JOIN (
    SELECT workspace_id, count(*) as total_views 
    FROM public.store_analytics_views 
    GROUP BY workspace_id
) v ON sp.workspace_id = v.workspace_id
LEFT JOIN (
    SELECT workspace_id, count(*) as total_clicks 
    FROM public.store_analytics_clicks 
    GROUP BY workspace_id
) c ON sp.workspace_id = c.workspace_id
LEFT JOIN (
    SELECT workspace_id, count(*) as total_followers 
    FROM public.store_interactions 
    WHERE type = 'FOLLOW' 
    GROUP BY workspace_id
) f ON sp.workspace_id = f.workspace_id
LEFT JOIN (
    SELECT workspace_id, count(*) as total_favorites 
    FROM public.store_interactions 
    WHERE type = 'FAVORITE' 
    GROUP BY workspace_id
) fav ON sp.workspace_id = fav.workspace_id
LEFT JOIN (
    SELECT workspace_id, ROUND(AVG(stars)::numeric, 1) as avg_rating, count(*) as total_ratings 
    FROM public.store_ratings 
    GROUP BY workspace_id
) r ON sp.workspace_id = r.workspace_id;

-- 7. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_analytics_views_workspace ON public.store_analytics_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_workspace ON public.store_analytics_clicks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicks_product ON public.store_analytics_clicks(product_id);
