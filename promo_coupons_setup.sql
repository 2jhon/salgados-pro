-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    discount_value NUMERIC NOT NULL,
    min_purchase_value NUMERIC,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for workspace + code
ALTER TABLE public.coupons ADD CONSTRAINT coupons_workspace_code_key UNIQUE (workspace_id, code);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can manage their workspace coupons" ON public.coupons;
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

-- Policies
CREATE POLICY "Users can manage their workspace coupons"
    ON public.coupons
    FOR ALL
    TO authenticated
    USING (workspace_id = get_my_workspace_id() OR is_super_admin())
    WITH CHECK (workspace_id = get_my_workspace_id() OR is_super_admin());

CREATE POLICY "Anyone can read active coupons"
    ON public.coupons
    FOR SELECT
    TO public
    USING (active = true);
