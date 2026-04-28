
-- ==========================================
-- SCRIPT DE CORREÇÃO DEFINITIVA (DATABASE)
-- ==========================================
-- Este script resolve:
-- 1. O erro da coluna 'commission_active' ausente
-- 2. O erro da tabela 'ads' que foi renomeada para 'app_banners'
-- 3. Atualiza a view de métricas do Super Admin

-- 1. GARANTIR QUE A TABELA ADS FOI RENOMEADA (Evita Ad-Blockers)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ads') THEN
        ALTER TABLE "public"."ads" RENAME TO "app_banners";
    END IF;
END $$;

-- 2. ADICIONAR COLUNAS DE COMISSÃO E MERCADO PAGO NA STORE_PROFILES
ALTER TABLE public.store_profiles 
ADD COLUMN IF NOT EXISTS commission_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mp_user_id TEXT,
ADD COLUMN IF NOT EXISTS mp_public_key TEXT;

-- 3. ADICIONAR STATUS DE PAGAMENTO NOS ANÚNCIOS (APP_BANNERS)
ALTER TABLE public.app_banners 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- 4. ATUALIZAR A VIEW DE MÉTRICAS (CORRIGINDO REFERÊNCIA A 'ads')
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

-- 5. CORREÇÃO DA TABELA DE PLANOS (SUBSCRIPTION_PLANS)
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS grants_pro BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grants_ad_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grants_advertiser BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS free_ads_per_month INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_price NUMERIC,
ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS promo_description TEXT,
ADD COLUMN IF NOT EXISTS grants_wa_automation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Zap',
ADD COLUMN IF NOT EXISTS benefits TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- 6. RECARREGAR CACHE DO POSTGREST (Importante para o erro de 'schema cache')
NOTIFY pgrst, 'reload schema';
