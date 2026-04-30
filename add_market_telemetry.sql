-- FASE 1: INFRAESTRUTURA DE TELEMETRIA AVANÇADA
-- Esta tabela registrará todo o comportamento de busca e cliques globalmente no Marketplace
-- para alimentar o futuro Algoritmo de Inteligência Artificial.

CREATE TABLE IF NOT EXISTS public.market_telemetry (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL,          -- Identificação anônima ou do dispositivo
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Se estiver logado
    event_type TEXT NOT NULL,          -- 'search', 'view_ad', 'view_store', 'click_ad', 'add_to_cart'
    target_id TEXT,                    -- ID do anúncio, produto ou texto da busca
    workspace_id TEXT REFERENCES public.store_profiles(workspace_id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb, -- Informações extras (ex: tags buscadas, tempo na tela)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.market_telemetry ENABLE ROW LEVEL SECURITY;

-- Políticas de Inserção Pública (Qualquer visitante pode gerar telemetria)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir insercao anonima na telemetria" ON public.market_telemetry;
    CREATE POLICY "Permitir insercao anonima na telemetria"
        ON public.market_telemetry FOR INSERT
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir leitura ao dono da loja sobre seus itens" ON public.market_telemetry;
    CREATE POLICY "Permitir leitura ao dono da loja sobre seus itens"
        ON public.market_telemetry FOR SELECT
        USING (workspace_id = public.get_my_workspace_id() OR public.is_super_admin());
END $$;

-- Criar índices de alta performance para o motor de recomendação (Fase 2+)
CREATE INDEX IF NOT EXISTS idx_market_telemetry_session ON public.market_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_market_telemetry_event ON public.market_telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_market_telemetry_target ON public.market_telemetry(target_id);
