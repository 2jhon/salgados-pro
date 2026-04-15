-- Cria uma View inteligente para consolidar métricas de empresas
-- Isso evita que o aplicativo tenha que baixar milhares de usuários e anúncios para fazer contas
CREATE OR REPLACE VIEW company_metrics AS
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
    -- Conta usuários vinculados a este workspace
    (SELECT count(*)::int FROM users u WHERE u.workspace_id = o.workspace_id) as user_count,
    -- Conta anúncios criados por este dono
    (SELECT count(*)::int FROM ads a WHERE a.owner_id = o.id) as ad_count
FROM users o
WHERE o.role = 'OWNER';

-- Comentário para documentação
COMMENT ON VIEW company_metrics IS 'View consolidada para o Painel Super Admin com métricas pré-calculadas';
