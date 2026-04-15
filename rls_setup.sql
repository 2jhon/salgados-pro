-- ====================================================================================
-- SCRIPT DE BLINDAGEM DE BANCO DE DADOS (RLS)
-- ====================================================================================

-- 1. Função auxiliar para pegar o workspace_id do usuário logado
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS TEXT AS $$
  SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1.1 Função para identificar Super Admins
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') IN (
    'hacker3d22@gmail.com', 
    'brasilanonymous66@gmail.com',
    'anonymousx484@gmail.com',
    'lillysilva345@gmail.com',
    'admin@admin.com',
    'admin@salgadospro.com.br',
    'suporte@salgadospro.com.br'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Habilitar RLS em todas as tabelas
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para TRANSACTIONS
DROP POLICY IF EXISTS "Isolar transactions por workspace" ON public.transactions;
CREATE POLICY "Isolar transactions por workspace" ON public.transactions
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 4. Políticas para APP_CONFIG
DROP POLICY IF EXISTS "Isolar app_config por workspace" ON public.app_config;
CREATE POLICY "Isolar app_config por workspace" ON public.app_config
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

DROP POLICY IF EXISTS "Permitir leitura publica de stalls" ON public.app_config;
CREATE POLICY "Permitir leitura publica de stalls" ON public.app_config
FOR SELECT TO public
USING (type = 'STALL_STYLE' AND is_public = true);

-- 5. Políticas para CUSTOMERS
DROP POLICY IF EXISTS "Isolar customers por workspace" ON public.customers;
CREATE POLICY "Isolar customers por workspace" ON public.customers
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 6. Políticas para STORE_PROFILES
DROP POLICY IF EXISTS "Isolar store_profiles por workspace" ON public.store_profiles;
CREATE POLICY "Isolar store_profiles por workspace" ON public.store_profiles
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

DROP POLICY IF EXISTS "Permitir leitura publica de perfis ativos" ON public.store_profiles;
CREATE POLICY "Permitir leitura publica de perfis ativos" ON public.store_profiles
FOR SELECT TO public
USING (active = true);

-- 7. Políticas para NOTES
DROP POLICY IF EXISTS "Isolar notes por workspace" ON public.notes;
CREATE POLICY "Isolar notes por workspace" ON public.notes
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 8. Políticas para ADS
DROP POLICY IF EXISTS "Isolar ads por workspace" ON public.ads;
CREATE POLICY "Isolar ads por workspace" ON public.ads
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

DROP POLICY IF EXISTS "Permitir leitura publica de ads ativos" ON public.ads;
CREATE POLICY "Permitir leitura publica de ads ativos" ON public.ads
FOR SELECT TO public
USING (active = true);

-- 9. Políticas para USERS
DROP POLICY IF EXISTS "Permitir insert no proprio auth_id ou workspace" ON public.users;
CREATE POLICY "Permitir insert no proprio auth_id ou workspace" ON public.users
FOR INSERT TO authenticated
WITH CHECK (auth_id = auth.uid() OR workspace_id = get_my_workspace_id() OR is_super_admin());

DROP POLICY IF EXISTS "Isolar users por workspace" ON public.users;
CREATE POLICY "Isolar users por workspace" ON public.users
FOR SELECT TO authenticated
USING (workspace_id = get_my_workspace_id() OR auth_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "Atualizar proprio user ou workspace" ON public.users;
CREATE POLICY "Atualizar proprio user ou workspace" ON public.users
FOR UPDATE TO authenticated
USING (workspace_id = get_my_workspace_id() OR auth_id = auth.uid() OR is_super_admin());

DROP POLICY IF EXISTS "Deletar users do workspace" ON public.users;
CREATE POLICY "Deletar users do workspace" ON public.users
FOR DELETE TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin());
