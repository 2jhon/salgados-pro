CREATE OR REPLACE FUNCTION public.find_user_bypass_rls(p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.users 
  WHERE (p_email IS NOT NULL AND p_email <> '' AND LOWER(email) = LOWER(p_email))
     OR (p_phone IS NOT NULL AND p_phone <> '' AND (phone = p_phone OR phone = '55' || p_phone OR phone = substring(p_phone from 3)))
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Também vamos corrigir as RLS para INSERTS
DROP POLICY IF EXISTS "Permitir inserção de usuários public/anon" ON public.users;
CREATE POLICY "Permitir inserção de usuários public/anon" ON public.users
FOR INSERT TO public
WITH CHECK (true);
