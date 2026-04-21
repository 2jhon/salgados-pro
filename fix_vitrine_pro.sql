-- ==========================================
-- CORREÇÃO DE SEGURANÇA: VITRINES PÚBLICAS
-- ==========================================
-- Esse script cria uma exibição (View) segura que garante
-- que APENAS lojas com o Plano Profissional ATIVO
-- apareçam no Marketplace, evitando que ex-assinantes fiquem online para sempre.

CREATE OR REPLACE VIEW public.vw_active_marketplace AS
SELECT sp.*
FROM public.store_profiles sp
INNER JOIN public.users u ON sp.workspace_id = u.workspace_id
WHERE sp.active = true 
  AND u.role = 'OWNER' 
  AND u.has_pro_plan = true 
  AND u.pro_expires_at > now();

-- Concedemos acesso a todos (usuários logados e anônimos)
-- para que os clientes e visitantes possam ver a vitrine e comprar.
GRANT SELECT ON public.vw_active_marketplace TO anon, authenticated;

-- Nota: A nova versão do seu App já está programada para 
-- começar a usar essa estrutura assim que você executar este comando.
-- Se o app não a encontrar, ele continuará funcionando do jeito antigo como fallback.
