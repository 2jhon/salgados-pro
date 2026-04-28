
-- ==========================================
-- CORREÇÃO DA TABELA DE PLANOS (SUPER ADMIN)
-- ==========================================

-- Garante que a tabela existe
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adiciona novas colunas se não existirem
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

-- Garante permissões
GRANT ALL ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

-- Recarrega Cache
NOTIFY pgrst, 'reload schema';
