-- Habilita a extensão de criptografia se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para sincronizar a senha do Auth com o access_code do public.users
CREATE OR REPLACE FUNCTION sync_user_auth(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_access_code TEXT;
  v_auth_id UUID;
BEGIN
  -- Busca o código de acesso e o ID de autenticação na tabela pública
  SELECT access_code, auth_id INTO v_access_code, v_auth_id 
  FROM public.users 
  WHERE id = p_user_id;

  -- Se ambos existirem, atualiza a senha no cofre do Supabase (auth.users)
  IF v_auth_id IS NOT NULL AND v_access_code IS NOT NULL AND v_access_code <> '' THEN
    UPDATE auth.users 
    SET encrypted_password = crypt(v_access_code, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_auth_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário de segurança: Esta função é SECURITY DEFINER para poder acessar a tabela auth.users,
-- mas ela só sincroniza dados que já existem na tabela public.users.
