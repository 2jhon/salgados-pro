-- Adiciona coluna para rastrear o ID de pagamento do Mercado Pago nos anúncios
ALTER TABLE public.app_banners ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE public.app_banners ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Garante que o status PAID não ative automaticamente se quisermos análise manual
COMMENT ON COLUMN public.app_banners.is_approved IS 'Define se o anúncio está visível na vitrine';
