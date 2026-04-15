-- Adiciona colunas de benefícios técnicos na tabela de planos
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS grants_pro BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grants_ad_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grants_advertiser BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS free_ads_per_month INTEGER DEFAULT 0;

-- Adiciona coluna para vincular o usuário a um plano específico na tabela de usuários
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS active_plan_id UUID REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS free_ads_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_free_ad_reset TIMESTAMPTZ DEFAULT NOW();

-- Comentários para documentação
COMMENT ON COLUMN subscription_plans.grants_pro IS 'Se o plano libera acesso às funções PRO (Vitrine, etc)';
COMMENT ON COLUMN subscription_plans.grants_ad_free IS 'Se o plano remove anúncios para o usuário';
COMMENT ON COLUMN subscription_plans.grants_advertiser IS 'Se o plano permite que o usuário crie anúncios';
COMMENT ON COLUMN subscription_plans.free_ads_per_month IS 'Quantidade de anúncios gratuitos inclusos por mês';
COMMENT ON COLUMN public.users.active_plan_id IS 'ID do plano atualmente vinculado ao usuário';
