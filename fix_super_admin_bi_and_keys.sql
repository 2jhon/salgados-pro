
-- 1. CORREÇÃO DA VIEW DE MÉTRICAS (GARANTIR UNICIDADE POR WORKSPACE E RIGOR DE PAPEL)
-- Resolve o erro de gerentes aparecendo como empresas no Super Admin
DROP VIEW IF EXISTS public.company_metrics CASCADE;

CREATE OR REPLACE VIEW public.company_metrics AS
SELECT DISTINCT ON (o.workspace_id)
    o.workspace_id,
    o.id as owner_id,
    o.name as company_name,
    o.email as owner_email,
    o.phone as owner_phone,
    o.has_pro_plan,
    o.pro_expires_at,
    o.is_ad_free,
    o.ad_free_expires_at,
    o.is_advertiser,
    o.advertiser_expires_at,
    o.created_at,
    o.last_seen,
    o.is_blocked,
    o.total_spent,
    o.plan_activations,
    o.custom_ad_price,
    o.custom_pro_price,
    o.active_plan_id,
    o.free_ads_used_this_month,
    COALESCE(s.commission_active, false) as commission_active,
    COALESCE(s.commission_rate, 0) as commission_rate,
    (CASE WHEN s.mp_access_token IS NOT NULL THEN true ELSE false END) as mp_connected,
    (SELECT count(*)::int FROM public.users u WHERE u.workspace_id = o.workspace_id) as user_count,
    (SELECT count(*)::int FROM public.app_banners a WHERE a.owner_id::text = o.id::text) as ad_count
FROM public.users o
LEFT JOIN public.store_profiles s ON s.workspace_id = o.workspace_id
WHERE o.role = 'OWNER' -- Filtro rigoroso: apenas quem tem papel de OWNER entra na lista de empresas
ORDER BY o.workspace_id, o.created_at ASC;

GRANT SELECT ON public.company_metrics TO authenticated;

GRANT SELECT ON public.company_metrics TO authenticated;

-- 2. GARANTIR RLS DE TELEMETRIA PARA SUPER ADMIN
-- Força a política de leitura para permitir que o Super Admin veja tudo globalmente
DROP POLICY IF EXISTS "Permitir leitura ao dono da loja sobre seus itens" ON public.market_telemetry;
CREATE POLICY "Leitura Global Super Admin e Local Owner"
    ON public.market_telemetry FOR SELECT
    USING (public.is_super_admin() OR workspace_id = public.get_my_workspace_id());

-- 3. RECARREGAR CACHE
NOTIFY pgrst, 'reload schema';
