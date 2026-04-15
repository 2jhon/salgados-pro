-- ====================================================================================
-- SCRIPT DE CORREÇÃO DE RLS PARA O SUPER ADMIN
-- ====================================================================================

-- 1. Criar função para identificar Super Admins de forma segura
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

-- 2. Atualizar Políticas da Tabela USERS
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

-- 3. Atualizar Políticas da Tabela TRANSACTIONS
DROP POLICY IF EXISTS "Isolar transactions por workspace" ON public.transactions;
CREATE POLICY "Isolar transactions por workspace" ON public.transactions
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 4. Atualizar Políticas da Tabela ADS
DROP POLICY IF EXISTS "Isolar ads por workspace" ON public.ads;
CREATE POLICY "Isolar ads por workspace" ON public.ads
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 5. Atualizar Políticas da Tabela APP_CONFIG
DROP POLICY IF EXISTS "Isolar app_config por workspace" ON public.app_config;
CREATE POLICY "Isolar app_config por workspace" ON public.app_config
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 6. Atualizar Políticas da Tabela NOTES
DROP POLICY IF EXISTS "Isolar notes por workspace" ON public.notes;
CREATE POLICY "Isolar notes por workspace" ON public.notes
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 7. Atualizar Políticas da Tabela STORE_PROFILES
DROP POLICY IF EXISTS "Isolar store_profiles por workspace" ON public.store_profiles;
CREATE POLICY "Isolar store_profiles por workspace" ON public.store_profiles
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 8. Atualizar Políticas da Tabela CUSTOMERS
DROP POLICY IF EXISTS "Isolar customers por workspace" ON public.customers;
CREATE POLICY "Isolar customers por workspace" ON public.customers
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());
