-- Adiciona campos de promoção para Anúncios Globais
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS promo_ad_price NUMERIC,
ADD COLUMN IF NOT EXISTS promo_ad_ends_at TIMESTAMPTZ;

-- Adiciona campos de promoção para Planos de Assinatura
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS promo_price NUMERIC,
ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN system_settings.promo_ad_price IS 'Preço promocional diário do anúncio';
COMMENT ON COLUMN system_settings.promo_ad_ends_at IS 'Data e hora de término da promoção de anúncios';
COMMENT ON COLUMN subscription_plans.promo_price IS 'Preço promocional mensal do plano';
COMMENT ON COLUMN subscription_plans.promo_ends_at IS 'Data e hora de término da promoção do plano';
