-- ==========================================
-- SISTEMA DE QUITAÇÃO DE NOTAS VIA PIX (MP)
-- ==========================================

-- 1. Ampliação da Tabela de Transações para Suportar Pagamentos Online
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS external_reference TEXT; -- ID Único para conciliação

-- Índices para busca rápida via Webhook
CREATE INDEX IF NOT EXISTS idx_tx_mp_pref ON public.transactions(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_tx_ext_ref ON public.transactions(external_reference);

-- 2. Tabela de Logs de Webhooks (Auditoria e Debug)
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT DEFAULT 'mercadopago',
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, ERROR
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Função para Dar Baixa Automática (Chamada pelo Webhook/Backend)
CREATE OR REPLACE FUNCTION public.process_note_payment(
    p_external_reference TEXT,
    p_payment_id TEXT,
    p_method TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_tx_id TEXT;
BEGIN
    -- Localiza a transação
    SELECT id INTO v_tx_id 
    FROM public.transactions 
    WHERE external_reference = p_external_reference 
       OR mp_preference_id = p_external_reference
    LIMIT 1;

    IF v_tx_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Atualiza TODAS as transações que compartilham a mesma referência externa
    UPDATE public.transactions
    SET 
        is_pending = false,
        payment_status = 'APPROVED',
        payment_method = p_method,
        paid_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('mp_payment_id', p_payment_id)
    WHERE external_reference = p_external_reference 
       OR mp_preference_id = p_external_reference;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ajuste de RLS para permitir que Clientes vejam suas próprias notas (se autenticados)
-- Nota: Geralmente clientes acessam via link público com token, mas se houver login:
-- DROP POLICY IF EXISTS "Clientes podem ver suas próprias notas" ON public.transactions;
-- CREATE POLICY "Clientes podem ver suas próprias notas" ON public.transactions
-- FOR SELECT TO authenticated
-- USING (customer_id::text = (SELECT id::text FROM public.customers WHERE email = auth.jwt() ->> 'email'));

-- 5. Recarregar o Esquema para o PostgREST
NOTIFY pgrst, 'reload schema';
