-- ==========================================
-- SISTEMA DE ARQUIVAMENTO AUTOMÁTICO
-- ==========================================

-- 1. Tabela de Resumos Históricos (Evita carregar milhares de linhas)
CREATE TABLE IF NOT EXISTS public.historical_summaries (
    id TEXT PRIMARY KEY, -- ex: summary_WID_YYYY_MM
    workspace_id TEXT NOT NULL,
    period_label TEXT NOT NULL, -- ex: "Janeiro 2024"
    year INT NOT NULL,
    month INT NOT NULL,
    total_sales NUMERIC DEFAULT 0,
    total_expenses NUMERIC DEFAULT 0,
    transaction_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_hist_summary_workspace ON public.historical_summaries(workspace_id);

-- 2. Controle de Último Processamento na Store Profiles
ALTER TABLE public.store_profiles 
ADD COLUMN IF NOT EXISTS last_auto_archive_at TIMESTAMP WITH TIME ZONE;

-- 3. Função de Consolidação (Pode ser chamada via RPC)
CREATE OR REPLACE FUNCTION public.archive_old_transactions(
    p_workspace_id TEXT,
    p_months_to_keep INT DEFAULT 6
)
RETURNS TABLE (
    archived_count INT,
    period_resumed TEXT
) AS $$
DECLARE
    v_cutoff_date TIMESTAMP;
    v_deleted_count INT;
BEGIN
    -- Define a data de corte (ex: 6 meses atrás do início do mês atual)
    v_cutoff_date := (date_trunc('month', now()) - (p_months_to_keep || ' months')::interval);

    -- 1. Inserir Resumos na historical_summaries
    -- Pegamos tudo que é anterior à data de corte que ainda não foi arquivado individualmente
    INSERT INTO public.historical_summaries (
        id, 
        workspace_id, 
        period_label, 
        year, 
        month, 
        total_sales, 
        total_expenses, 
        transaction_count
    )
    SELECT 
        'summary_' || p_workspace_id || '_' || EXTRACT(YEAR FROM date) || '_' || EXTRACT(MONTH FROM date) as sid,
        p_workspace_id,
        to_char(date, 'MM/YYYY'),
        EXTRACT(YEAR FROM date)::INT,
        EXTRACT(MONTH FROM date)::INT,
        SUM(CASE WHEN sub_category != 'GASTOS' THEN value ELSE 0 END) as sales,
        SUM(CASE WHEN sub_category = 'GASTOS' THEN value ELSE 0 END) as expenses,
        COUNT(*)
    FROM public.transactions
    WHERE workspace_id = p_workspace_id
      AND is_pending = false
      AND date < v_cutoff_date
    GROUP BY 1, 2, 3, 4, 5
    ON CONFLICT (id) DO UPDATE SET 
        total_sales = historical_summaries.total_sales + EXCLUDED.total_sales,
        total_expenses = historical_summaries.total_expenses + EXCLUDED.total_expenses,
        transaction_count = historical_summaries.transaction_count + EXCLUDED.transaction_count;

    -- 2. Deletar as transações originais
    WITH deleted AS (
        DELETE FROM public.transactions
        WHERE workspace_id = p_workspace_id
          AND is_pending = false
          AND date < v_cutoff_date
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    -- 3. Atualizar carimbo de data na store_profiles
    UPDATE public.store_profiles 
    SET last_auto_archive_at = now()
    WHERE workspace_id = p_workspace_id;

    RETURN QUERY SELECT v_deleted_count, 'Até ' || v_cutoff_date::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION public.archive_old_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.historical_summaries TO authenticated;
