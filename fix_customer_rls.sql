CREATE OR REPLACE FUNCTION get_my_phone_number() RETURNS TEXT AS $$
  SELECT phone FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "Clientes podem ver suas notas" ON public.transactions;
CREATE POLICY "Clientes podem ver suas notas" ON public.transactions
FOR SELECT TO authenticated
USING (
  customer_phone = get_my_phone_number()
);
