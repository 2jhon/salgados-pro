DROP POLICY IF EXISTS "Users can manage their workspace coupons" ON public.coupons;
CREATE POLICY "Users can manage their workspace coupons"
    ON public.coupons
    FOR ALL
    TO authenticated
    USING (workspace_id = get_my_workspace_id() OR is_super_admin())
    WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());
