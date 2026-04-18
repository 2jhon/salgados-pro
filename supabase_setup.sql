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
CREATE OR REPLACE FUNCTION decrement_stock(
    p_workspace_id TEXT,
    p_section_id TEXT,
    p_item_id TEXT,
    p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_stock NUMERIC;
    v_my_workspace TEXT;
BEGIN
    -- SEGURANÇA: Verifica se o usuário tem permissão para este workspace
    -- Usamos a função get_my_workspace_id() que já está definida
    v_my_workspace := public.get_my_workspace_id();
    
    -- Admins específicos ou o próprio dono do workspace podem operar
    IF v_my_workspace <> p_workspace_id AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso negado ao estoque deste workspace.';
    END IF;

    -- Bloqueia a linha para atualização (evita race condition)
    SELECT quantity INTO v_current_stock 
    FROM public.inventory 
    WHERE workspace_id = p_workspace_id 
      AND section_id = p_section_id 
      AND item_id = p_item_id 
    FOR UPDATE;

    -- Se o item não existir, insere com estoque negativo (ou zero, dependendo da regra)
    IF NOT FOUND THEN
        INSERT INTO public.inventory (workspace_id, section_id, item_id, quantity)
        VALUES (p_workspace_id, p_section_id, p_item_id, -p_amount);
        RETURN TRUE;
    END IF;

    -- Atualiza o estoque
    UPDATE public.inventory 
    SET quantity = quantity - p_amount,
        updated_at = NOW()
    WHERE workspace_id = p_workspace_id 
      AND section_id = p_section_id 
      AND item_id = p_item_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Habilitar Realtime para a tabela transactions (Se ainda não estiver)
-- Vá em Database -> Replication -> supabase_realtime e ative para a tabela 'transactions'
