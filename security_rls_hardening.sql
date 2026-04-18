-- ====================================================================================
-- SCRIPT DE CORREÇÃO DE SEGURANÇA CRÍTICA - RLS
-- ====================================================================================

-- 1. Hardening public.users POLICY
-- Impede que usuários troquem seu próprio workspace_id ou role, a menos que sejam Super Admins

DROP POLICY IF EXISTS "Atualizar proprio user ou workspace" ON public.users;

CREATE POLICY "Atualizar proprio perfil" ON public.users
FOR UPDATE TO authenticated
USING (
  (auth_id = auth.uid() OR is_super_admin())
)
WITH CHECK (
  -- Permite atualizar se for super admin OU se o workspace_id e role não estiverem sendo alterados
  is_super_admin() OR (
    auth_id = auth.uid() 
    AND workspace_id = (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    AND role = (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
);

-- 2. Hardening public.inventory POLICY
-- Isola inventário por workspace (Atualmente está aberto para todos os autenticados)

DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.inventory;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.inventory;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.inventory;

CREATE POLICY "Isolar inventory por workspace" ON public.inventory
FOR ALL TO authenticated
USING (workspace_id = get_my_workspace_id() OR is_super_admin())
WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

-- 3. Adicionar políticas para reports que faltavam em scripts anteriores
DROP POLICY IF EXISTS "Super Admin Total Access Reports" ON public.reports;
CREATE POLICY "Super Admin Total Access Reports" ON public.reports
FOR ALL TO authenticated
USING (is_super_admin());
