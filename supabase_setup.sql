-- ====================================================================================
-- SCRIPT DE ATUALIZAÇÃO DO SUPABASE (ESTOQUE ATÔMICO E REALTIME)
-- ====================================================================================
-- Execute este script no SQL Editor do seu painel do Supabase para criar a tabela
-- de inventário e a função RPC que resolve definitivamente o problema de Race Condition.

-- 1. Criar a tabela de inventário separada
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    min_stock NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, section_id, item_id)
);

-- 2. Habilitar RLS (Row Level Security) na nova tabela
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de acesso (Ajuste conforme suas regras de negócio)
CREATE POLICY "Permitir leitura para usuários autenticados" 
ON public.inventory FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir atualização para usuários autenticados" 
ON public.inventory FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON public.inventory FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 4. Criar a função RPC para decrementar o estoque atomicamente
DROP FUNCTION IF EXISTS public.decrement_stock(TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.decrement_stock(
    p_workspace_id TEXT,
    p_section_id TEXT,
    p_item_id TEXT,
    p_amount NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    v_new_quantity NUMERIC;
    v_my_workspace TEXT;
BEGIN
    -- SEGURANÇA: Verifica se o usuário tem permissão para este workspace
    v_my_workspace := public.get_my_workspace_id();
    
    -- Se v_my_workspace for nulo ou não bater, e não for super admin, barramos
    IF (v_my_workspace IS NULL OR v_my_workspace <> p_workspace_id) AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso negado ao estoque deste workspace.';
    END IF;

    -- Upsert atômico com retorno do novo valor
    -- Se p_amount é negativo (ex: -10), quantity aumenta 10.
    INSERT INTO public.inventory (workspace_id, section_id, item_id, quantity, updated_at)
    VALUES (p_workspace_id, p_section_id, p_item_id, -p_amount, NOW())
    ON CONFLICT (workspace_id, section_id, item_id)
    DO UPDATE SET 
        quantity = COALESCE(inventory.quantity, 0) - p_amount,
        updated_at = NOW()
    RETURNING quantity INTO v_new_quantity;

    RETURN v_new_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Habilitar Realtime para a tabela transactions (Se ainda não estiver)
-- Vá em Database -> Replication -> supabase_realtime e ative para a tabela 'transactions'
