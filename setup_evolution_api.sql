-- ==========================================
-- SISTEMA DE NOTIFICAÇÕES WHATSAPP (EVOLUTION API)
-- ==========================================

-- 1. Ampliação do Perfil da Loja para Configurações do WhatsApp
ALTER TABLE public.store_profiles 
ADD COLUMN IF NOT EXISTS wa_instance_name TEXT,
ADD COLUMN IF NOT EXISTS wa_instance_status TEXT DEFAULT 'DISCONNECTED', -- CONNECTED, DISCONNECTED, PAIRING
ADD COLUMN IF NOT EXISTS wa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_notify_on_payment BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS wa_notify_on_new_note BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_notify_on_new_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS wa_token_internal TEXT; -- Token único para pareamento via webhook se necessário

-- 2. Tabela de Logs de Mensagens (Fila e Histórico)
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'OUTGOING', -- OUTGOING, INCOMING
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, ERROR
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wa_logs_workspace ON public.whatsapp_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON public.whatsapp_logs(status);

-- 3. Permissões
GRANT ALL ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;

-- 4. Recarregar o Esquema
NOTIFY pgrst, 'reload schema';
