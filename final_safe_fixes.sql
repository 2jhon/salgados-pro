-- ====================================================================================
-- FINAL SAFE FIXES: AUTH OVERLOAD & SUPER ADMIN ROBUSTNESS
-- ====================================================================================

-- 1. Overload para authenticate_user com 2 argumentos (compatibilidade com código antigo)
CREATE OR REPLACE FUNCTION authenticate_user(p_identifier TEXT, p_pin TEXT) 
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.users 
  WHERE (email = p_identifier OR phone = p_identifier OR phone = '55' || p_identifier OR phone = substring(p_identifier from 3)) 
  AND access_code = p_pin 
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.1 Garante permissão para a nova assinatura
GRANT EXECUTE ON FUNCTION public.authenticate_user(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_user(text, text) TO authenticated;

-- 2. Reforçar is_super_admin para ser estável e lidar com logins sem email no JWT se necessário
-- (Embora o padrão seja email, adicionamos segurança extra)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Tenta pegar do JWT
  v_email := auth.jwt() ->> 'email';
  
  -- Se não tiver no JWT, tenta buscar na tabela de usuários se o auth_id estiver presente
  IF v_email IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT email INTO v_email FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  END IF;

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

-- 3. Garantir que a VIEW company_metrics tenha permissão para Super Admin via RLS
-- Views não tem RLS próprio, mas as tabelas base tem. 
-- Como a view é SECURITY DEFINER seria perigoso, mas aqui ela é padrão (Invoker).
-- O Super Admin já tem acesso total nas tabelas base via super_admin_rls_fix.sql.

-- 4. Função para limpar cache ou forçar re-sincronização se necessário
-- (Opcional, mas útil para debug)
CREATE OR REPLACE FUNCTION public.get_system_status()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'db_online', true,
    'server_time', now(),
    'company_count', (SELECT count(*) FROM users WHERE role = 'OWNER'),
    'is_admin', is_super_admin()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_system_status() TO authenticated;
