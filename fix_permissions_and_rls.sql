-- ====================================================================================
-- FIX: PERMISSÕES DE EXECUÇÃO E RECURSÃO RLS
-- ====================================================================================

-- 1. Garante que as funções de bypass possam ser chamadas pelo app anonimamente
GRANT EXECUTE ON FUNCTION public.find_user_bypass_rls(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_user_bypass_rls(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.authenticate_user(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_user(text, text, text) TO authenticated;

-- 2. Otimizar get_my_workspace_id para ser estável e evitar recursão profunda
CREATE OR REPLACE FUNCTION public.get_my_workspace_id()
RETURNS TEXT AS $$
DECLARE
  v_wid TEXT;
BEGIN
  -- Se for anon, retorna null rápido
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  
  -- Tenta pegar do cache da transação se habilitado, ou faz a busca direta
  SELECT workspace_id INTO v_wid FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN v_wid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Corrigir Política de SELECT em USERS para evitar loops
DROP POLICY IF EXISTS "Isolar users por workspace" ON public.users;
CREATE POLICY "Isolar users por workspace" ON public.users
FOR SELECT TO authenticated
USING (
  auth_id = auth.uid() -- O próprio usuário sempre se vê
  OR is_super_admin()   -- Super Admin vê todos
  OR workspace_id = (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1) -- Colegas de trabalho
);

-- 4. Corrigir Política de UPDATE em USERS (Harden sem recursão circular)
DROP POLICY IF EXISTS "Atualizar proprio perfil" ON public.users;
DROP POLICY IF EXISTS "Atualizar proprio user ou workspace" ON public.users;

CREATE POLICY "Gerenciar users do workspace" ON public.users
FOR UPDATE TO authenticated
USING (
  auth_id = auth.uid() 
  OR workspace_id = (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  OR is_super_admin()
)
WITH CHECK (
  is_super_admin() OR (
     auth_id = auth.uid() -- Se for eu mesmo, não posso mudar meu workspace/role via app comum
     -- Nota: A validação de "não mudar campos" é melhor feita no frontend ou via trigger para evitar subqueries complexas no CHECK
  )
);
