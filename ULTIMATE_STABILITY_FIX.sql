-- ====================================================================================
-- ULTIMATE STABILITY & AUTHENTICATION FIX
-- Este script resolve:
-- 1. Overload de authenticate_user (2 e 3 argumentos)
-- 2. Recursão infinita em políticas RLS de users
-- 3. Visibilidade do Super Admin e Managers
-- 4. Saúde da View company_metrics
-- ====================================================================================

-- 1. Funções de Segurança Definitivas (SECURITY DEFINER para evitar recursão de RLS e garantir performance)
CREATE OR REPLACE FUNCTION public.get_my_workspace_id()
RETURNS TEXT AS $$
DECLARE
  v_wid TEXT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  
  -- SELECT direto em tabela com RLS dentro de SECURITY DEFINER ignora RLS da tabela
  -- Usamos casting explícito para evitar erros de tipo
  SELECT workspace_id INTO v_wid FROM public.users WHERE auth_id::text = v_uid::text LIMIT 1;
  RETURN v_wid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := auth.jwt() ->> 'email';
  IF v_email IS NULL THEN RETURN FALSE; END IF;
  
  RETURN LOWER(v_email) IN (
    'hacker3d22@gmail.com', 
    'brasilanonymous66@gmail.com',
    'anonymousx484@gmail.com',
    'lillysilva345@gmail.com',
    'admin@admin.com',
    'admin@salgadospro.com.br',
    'suporte@salgadospro.com.br'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Overloads de Autenticação (Garante compatibilidade com todas as chamadas do App)

-- Função para busca segura de usuário ignorando RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.find_user_bypass_rls(p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.users 
  WHERE (p_email IS NOT NULL AND LOWER(email) = LOWER(p_email))
     OR (p_phone IS NOT NULL AND (phone = p_phone OR phone = '55' || p_phone OR phone = substring(p_phone from 3)))
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Versão 2 argumentos: Usada no login simplificado
CREATE OR REPLACE FUNCTION public.authenticate_user(p_identifier TEXT, p_pin TEXT) 
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.users 
  WHERE (email = p_identifier OR phone = p_identifier OR phone = '55' || p_identifier OR phone = substring(p_identifier from 3)) 
    AND access_code = p_pin 
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Versão 3 argumentos: Usada quando o tipo é especificado
CREATE OR REPLACE FUNCTION public.authenticate_user(p_identifier TEXT, p_pin TEXT, p_type TEXT) 
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

-- 3. Reset e Blindagem de RLS para a tabela USERS (Evita recursão e garante visibilidade)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Isolar users por workspace" ON public.users;
DROP POLICY IF EXISTS "Permitir insert no proprio auth_id ou workspace" ON public.users;
DROP POLICY IF EXISTS "Atualizar proprio user ou workspace" ON public.users;
DROP POLICY IF EXISTS "Deletar users do workspace" ON public.users;
DROP POLICY IF EXISTS "Atualizar proprio perfil" ON public.users;

-- Política de Leitura (Crucial para ver gerentes)
CREATE POLICY "Estratégia de Leitura Users" ON public.users
FOR SELECT TO authenticated
USING (
  auth_id = auth.uid() 
  OR is_super_admin()
  OR workspace_id = get_my_workspace_id() -- Uso da função SECURITY DEFINER remove recursão
);

-- Política de Inserção
CREATE POLICY "Estratégia de Inserção Users" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
  auth_id = auth.uid() 
  OR workspace_id = get_my_workspace_id() 
  OR is_super_admin()
);

-- Política de Atualização (Evita que gerente mude o workspace dele mesmo)
CREATE POLICY "Estratégia de Atualização Users" ON public.users
FOR UPDATE TO authenticated
USING (
  auth_id = auth.uid() 
  OR is_super_admin()
  OR workspace_id = get_my_workspace_id()
)
WITH CHECK (
  is_super_admin() OR (
    auth_id = auth.uid() 
    -- Impede mudar role ou workspace se não for admin
    AND (role = (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) OR role IS NULL)
    AND (workspace_id = (SELECT workspace_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1) OR workspace_id IS NULL)
  )
);

-- Política de Deleção
CREATE POLICY "Estratégia de Deleção Users" ON public.users
FOR DELETE TO authenticated
USING (
  workspace_id = get_my_workspace_id() 
  OR is_super_admin()
);

-- 4. Reparar a VIEW company_metrics
DROP VIEW IF EXISTS public.company_metrics CASCADE;
CREATE OR REPLACE VIEW public.company_metrics AS
SELECT 
    o.id as owner_id,
    o.workspace_id,
    o.name as company_name,
    o.email as owner_email,
    o.phone as owner_phone,
    o.has_pro_plan,
    o.pro_expires_at,
    o.is_ad_free,
    o.ad_free_expires_at,
    o.is_advertiser,
    o.advertiser_expires_at,
    o.created_at,
    o.last_seen,
    o.is_blocked,
    o.total_spent,
    o.plan_activations,
    o.custom_ad_price,
    o.custom_pro_price,
    o.active_plan_id,
    o.free_ads_used_this_month,
    (SELECT count(*)::int FROM public.users u WHERE u.workspace_id = o.workspace_id) as user_count,
    (SELECT count(*)::int FROM public.ads a WHERE a.owner_id::text = o.id::text) as ad_count
FROM public.users o
WHERE o.role = 'OWNER';

-- 5. Conceder Permissões Finais
GRANT EXECUTE ON FUNCTION public.authenticate_user(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_user(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_bypass_rls(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT SELECT ON public.company_metrics TO authenticated;

-- Garante que o sync_user_auth suporte UUID ou converta strings
CREATE OR REPLACE FUNCTION sync_user_auth(p_user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_access_code TEXT;
  v_auth_id UUID;
  v_email TEXT;
  v_uid UUID;
BEGIN
  -- Tenta converter o text para UUID se possível
  BEGIN
    v_uid := p_user_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- Se não for UUID (ex: ID numérico), busca por ele como string na tabela
    SELECT access_code, auth_id, email INTO v_access_code, v_auth_id, v_email
    FROM public.users WHERE id::text = p_user_id LIMIT 1;
    
    IF v_auth_id IS NOT NULL THEN
      UPDATE auth.users 
      SET encrypted_password = crypt(v_access_code, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_auth_id;
      RETURN v_email;
    END IF;
    RETURN NULL;
  END;

  -- Se chegamos aqui, v_uid é um UUID válido
  SELECT access_code, auth_id, email INTO v_access_code, v_auth_id, v_email
  FROM public.users WHERE id::text = v_uid::text;

  IF v_auth_id IS NOT NULL AND v_access_code IS NOT NULL AND v_access_code <> '' THEN
    UPDATE auth.users 
    SET encrypted_password = crypt(v_access_code, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_auth_id;
    RETURN v_email;
  END IF;
  
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_user_auth(TEXT) TO anon, authenticated;
