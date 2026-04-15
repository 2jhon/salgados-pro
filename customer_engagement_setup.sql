-- ====================================================================================
-- FASE 1: ENGAJAMENTO E FIDELIDADE DO CLIENTE (AVALIAÇÕES E FAVORITOS)
-- ====================================================================================

-- 1. Tabela de Interações (Seguir/Favoritar)
CREATE TABLE IF NOT EXISTS public.store_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- Referência ao ID do usuário (cliente)
    workspace_id TEXT NOT NULL, -- Referência à loja
    type TEXT NOT NULL CHECK (type IN ('FOLLOW', 'FAVORITE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, workspace_id, type) -- Evita duplicidade (não pode seguir a mesma loja 2x)
);

-- 2. Tabela de Avaliações (Ratings)
CREATE TABLE IF NOT EXISTS public.store_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- Referência ao ID do usuário (cliente)
    workspace_id TEXT NOT NULL, -- Referência à loja avaliada
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, workspace_id) -- Apenas uma avaliação por usuário por loja (pode ser atualizada)
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.store_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_ratings ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança para store_interactions
DROP POLICY IF EXISTS "Permitir leitura pública de interações" ON public.store_interactions;
DROP POLICY IF EXISTS "Permitir inserção pelo próprio usuário" ON public.store_interactions;
DROP POLICY IF EXISTS "Permitir deleção pelo próprio usuário" ON public.store_interactions;

CREATE POLICY "Permitir leitura pública de interações" 
ON public.store_interactions FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pelo próprio usuário" 
ON public.store_interactions FOR INSERT 
WITH CHECK (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

CREATE POLICY "Permitir deleção pelo próprio usuário" 
ON public.store_interactions FOR DELETE 
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

-- 5. Políticas de Segurança para store_ratings
DROP POLICY IF EXISTS "Permitir leitura pública de avaliações" ON public.store_ratings;
DROP POLICY IF EXISTS "Permitir inserção pelo próprio usuário" ON public.store_ratings;
DROP POLICY IF EXISTS "Permitir atualização pelo próprio usuário" ON public.store_ratings;
DROP POLICY IF EXISTS "Permitir deleção pelo próprio usuário" ON public.store_ratings;

CREATE POLICY "Permitir leitura pública de avaliações" 
ON public.store_ratings FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pelo próprio usuário" 
ON public.store_ratings FOR INSERT 
WITH CHECK (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

CREATE POLICY "Permitir atualização pelo próprio usuário" 
ON public.store_ratings FOR UPDATE 
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

CREATE POLICY "Permitir deleção pelo próprio usuário" 
ON public.store_ratings FOR DELETE 
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);
