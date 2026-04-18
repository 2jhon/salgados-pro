-- Habilita a extensão de criptografia se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Apaga a versão antiga para permitir a mudança do tipo de retorno (se necessário)
DROP FUNCTION IF EXISTS sync_user_auth(uuid);

-- 2. Cria a nova versão robusta
CREATE OR REPLACE FUNCTION sync_user_auth(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_access_code TEXT;
  v_auth_id UUID;
  v_email TEXT;
BEGIN
  -- Define o path para garantir que pgcrypto e tabelas sejam encontrados
  -- Nota: extensões costumam ficar no esquema 'extensions' ou 'public'
  SET search_path = public, auth, extensions;

  -- Busca o código de acesso, e-mail e o ID de autenticação na tabela pública
  SELECT access_code, auth_id, email INTO v_access_code, v_auth_id, v_email
  FROM public.users 
  WHERE id = p_user_id;

  -- Se ambos existirem, atualiza a senha no cofre do Supabase (auth.users)
  IF v_auth_id IS NOT NULL AND v_access_code IS NOT NULL AND v_access_code <> '' THEN
    UPDATE auth.users 
    SET encrypted_password = crypt(v_access_code, gen_salt('bf')),
        updated_at = now(),
        last_sign_in_at = NULL,
        email_confirmed_at = COALESCE(email_confirmed_at, now()), -- Força confirmação de e-mail
        confirmation_token = NULL
    WHERE id = v_auth_id;
    
    RETURN v_email;
  END IF;
  
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garante que o app (anon e authenticated) possa chamar esta função
GRANT EXECUTE ON FUNCTION sync_user_auth(uuid) TO anon;
GRANT EXECUTE ON FUNCTION sync_user_auth(uuid) TO authenticated;

-- Comentário de segurança: Esta função é SECURITY DEFINER para poder acessar a tabela auth.users,
-- mas ela só sincroniza dados que já existem na tabela public.users, protegendo o acesso.
