
-- Adiciona coluna de status de pagamento aos anúncios
ALTER TABLE public.app_banners ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.app_banners ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Atualiza a View de Métricas para usar app_banners e filtrar por pagamento aprovado ou super admin
DROP VIEW IF EXISTS public.company_metrics CASCADE;

CREATE OR REPLACE VIEW public.company_metrics AS
SELECT 
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
WHERE o.role = 'OWNER';

GRANT SELECT ON public.company_metrics TO authenticated;

-- Adiciona coluna payment_status na tabela ads caso o script de renomeação não tenha rodado ainda (redundância)
ALTER TABLE IF EXISTS public.ads ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE IF EXISTS public.ads ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
