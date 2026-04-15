-- ====================================================================================
-- SCRIPT DE CONFIGURAÇÃO DO KARDEX (HISTÓRICO DE ESTOQUE)
-- ====================================================================================

-- 1. Criar a tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    reason TEXT NOT NULL CHECK (reason IN ('PRODUCTION', 'SALE', 'MANUAL_ADJUSTMENT', 'LOSS', 'RETURN')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    previous_balance NUMERIC NOT NULL,
    new_balance NUMERIC NOT NULL,
    created_by TEXT,
    reference_id TEXT, -- ID da transação ou lote que gerou o movimento
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para otimizar consultas (relatórios serão muito acessados)
CREATE INDEX IF NOT EXISTS idx_stock_movements_workspace ON public.stock_movements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(created_at DESC);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas se existirem (para garantir atualização limpa)
DROP POLICY IF EXISTS "Isolar stock_movements por workspace" ON public.stock_movements;

-- 5. Criar política de segurança (Apenas usuários do mesmo workspace podem ler/inserir)
CREATE POLICY "Isolar stock_movements por workspace" 
    ON public.stock_movements
    FOR ALL
    TO authenticated
    USING (workspace_id = get_my_workspace_id() OR is_super_admin())
    WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());
