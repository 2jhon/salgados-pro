-- ====================================================================================
-- SCRIPT DE GESTÃO FINANCEIRA (PLANOS E PREÇOS DINÂMICOS)
-- ====================================================================================

-- 1. Criar tabela de Configurações Globais do Sistema
-- Armazena valores que antes estavam fixos no código
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'GLOBAL',
    ad_daily_price NUMERIC DEFAULT 5.00,
    support_phone TEXT DEFAULT '21999999999',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir valores iniciais (Kernel)
INSERT INTO public.system_settings (id, ad_daily_price, support_phone)
VALUES ('GLOBAL', 5.00, '21999999999')
ON CONFLICT (id) DO NOTHING;

-- 2. Criar tabela de Planos de Assinatura
-- Permite criar, editar e desativar planos sem mexer no código
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT,
    benefits JSONB DEFAULT '[]'::jsonb,
    icon TEXT DEFAULT 'Zap', -- Nome do ícone do Lucide (Zap, EyeOff, Star, etc)
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir planos padrão (Migração do que era estático)
INSERT INTO public.subscription_plans (name, price, description, benefits, icon, sort_order)
VALUES 
('Plano PRO', 34.90, 'Gestão Completa + Vitrine Online', '["Gestão de Fábrica", "Gestão de Barraca", "Vitrine Online", "Suporte Prioritário"]'::jsonb, 'Zap', 1),
('Remover Anúncios', 9.90, 'Navegação limpa sem interrupções', '["Sem anúncios de terceiros", "Navegação mais rápida"]'::jsonb, 'EyeOff', 2)
ON CONFLICT DO NOTHING;

-- 3. Adicionar colunas de preços customizados na tabela de usuários
-- Isso permite dar descontos individuais para empresas específicas
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_ad_price NUMERIC;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_pro_price NUMERIC;

-- 4. Habilitar RLS (Segurança)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso
-- Leitura: Todos os usuários autenticados podem ver os preços e planos
DROP POLICY IF EXISTS "Leitura pública de configurações" ON public.system_settings;
CREATE POLICY "Leitura pública de configurações" ON public.system_settings 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Leitura pública de planos" ON public.subscription_plans;
CREATE POLICY "Leitura pública de planos" ON public.subscription_plans 
FOR SELECT TO authenticated USING (true);

-- Escrita: Apenas Super Admins podem alterar preços e planos
-- (A função is_super_admin() já deve estar criada no seu banco)
DROP POLICY IF EXISTS "Apenas Super Admin altera configurações" ON public.system_settings;
CREATE POLICY "Apenas Super Admin altera configurações" ON public.system_settings 
FOR ALL TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Apenas Super Admin altera planos" ON public.subscription_plans;
CREATE POLICY "Apenas Super Admin altera planos" ON public.subscription_plans 
FOR ALL TO authenticated USING (is_super_admin());
