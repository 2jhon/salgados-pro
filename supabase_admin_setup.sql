-- ====================================================================================
-- SCRIPT DE ATUALIZAÇÃO DO SUPABASE (MODERAÇÃO E EXCLUSÃO)
-- ====================================================================================

-- 1. Atualizar a tabela users com novos campos de moderação e métricas
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_activations INTEGER DEFAULT 0;

-- 2. Criar a tabela de denúncias (reports)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    reported_workspace_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, RESOLVED, DISMISSED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS na tabela reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para reports (Usuários podem criar, Admin pode ler/atualizar)
DROP POLICY IF EXISTS "Permitir inserção de denúncias para autenticados" ON public.reports;
DROP POLICY IF EXISTS "Permitir leitura de denúncias para autenticados" ON public.reports;
DROP POLICY IF EXISTS "Permitir atualização de denúncias para autenticados" ON public.reports;
DROP POLICY IF EXISTS "Permitir leitura de denúncias apenas para Admin" ON public.reports;
DROP POLICY IF EXISTS "Permitir atualização de denúncias apenas para Admin" ON public.reports;

CREATE POLICY "Permitir inserção de denúncias para autenticados" 
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid()::text = reporter_id);

CREATE POLICY "Permitir leitura de denúncias apenas para Admin" 
ON public.reports FOR SELECT 
TO authenticated 
USING (
  (auth.jwt() ->> 'email') IN ('hacker3d22@gmail.com', 'brasilanonymous66@gmail.com')
);

CREATE POLICY "Permitir atualização de denúncias apenas para Admin" 
ON public.reports FOR UPDATE 
TO authenticated 
USING (
  (auth.jwt() ->> 'email') IN ('hacker3d22@gmail.com', 'brasilanonymous66@gmail.com')
);

-- 5. Função RPC para Exclusão Total (Hard Delete) de um Workspace
CREATE OR REPLACE FUNCTION hard_delete_workspace(p_workspace_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
    -- VERIFICAÇÃO DE SEGURANÇA: Apenas o Super Admin pode executar
    IF (current_setting('request.jwt.claims', true)::json ->> 'email') NOT IN ('hacker3d22@gmail.com', 'brasilanonymous66@gmail.com') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas o Super Admin pode excluir workspaces.';
    END IF;

    -- Deleta transações
    DELETE FROM public.transactions WHERE workspace_id = p_workspace_id;
    
    -- Deleta inventário (se existir)
    DELETE FROM public.inventory WHERE workspace_id = p_workspace_id;
    
    -- Deleta notas
    DELETE FROM public.notes WHERE workspace_id = p_workspace_id;
    
    -- Deleta anúncios
    DELETE FROM public.ads WHERE workspace_id = p_workspace_id;
    
    -- Deleta perfil da loja
    DELETE FROM public.store_profiles WHERE workspace_id = p_workspace_id;
    
    -- Deleta configurações do app
    DELETE FROM public.app_config WHERE workspace_id = p_workspace_id;
    
    -- Finalmente, deleta os usuários associados ao workspace
    DELETE FROM public.users WHERE workspace_id = p_workspace_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC para Autenticação Segura (Verificação de PIN no backend)
CREATE OR REPLACE FUNCTION authenticate_user(p_identifier TEXT, p_pin TEXT, p_type TEXT) 
RETURNS SETOF public.users AS $$
BEGIN
  IF p_type = 'COMPANY' THEN
    RETURN QUERY SELECT * FROM public.users 
    WHERE email = p_identifier AND access_code = p_pin AND user_type = 'COMPANY' 
    LIMIT 1;
  ELSE
    RETURN QUERY SELECT * FROM public.users 
    WHERE (phone = p_identifier OR phone = '55' || p_identifier OR phone = substring(p_identifier from 3)) 
    AND access_code = p_pin 
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para busca bypass (Essencial para o Mestre da Sincronização)
CREATE OR REPLACE FUNCTION find_user_bypass_rls(p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.users
  WHERE (p_email IS NOT NULL AND LOWER(email) = LOWER(p_email))
     OR (p_phone IS NOT NULL AND (phone = p_phone OR phone = '55' || p_phone OR phone = SUBSTRING(p_phone FROM 3)))
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
