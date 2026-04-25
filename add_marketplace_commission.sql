
-- Adiciona campos para o sistema de comissão e marketplace (Mercado Pago)
ALTER TABLE public.store_profiles 
ADD COLUMN IF NOT EXISTS commission_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mp_user_id TEXT,
ADD COLUMN IF NOT EXISTS mp_public_key TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.store_profiles.commission_active IS 'Indica se a plataforma cobra comissão sobre as vendas desta loja';
COMMENT ON COLUMN public.store_profiles.commission_rate IS 'Percentual de comissão cobrado pelo Super Admin (Ex: 10 = 10%)';
COMMENT ON COLUMN public.store_profiles.mp_access_token IS 'Access Token do Mercado Pago da loja (obtido via OAuth)';
