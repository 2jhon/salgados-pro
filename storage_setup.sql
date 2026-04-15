
-- Script para preparar a infraestrutura de armazenamento de imagens (Supabase Storage)
-- Este script deve ser executado no SQL Editor do Supabase

-- 1. Criar o bucket 'ads' se ele não existir
-- Nota: Em algumas versões do Supabase, a criação de buckets via SQL pode exigir permissões especiais.
-- Se este comando falhar, crie o bucket manualmente com o nome 'ads' no painel Storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ads', 'ads', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Configurar Políticas de Segurança (RLS) para o bucket 'ads'

-- Permitir que qualquer pessoa visualize as imagens (Público)
CREATE POLICY "Imagens de anúncios são públicas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'ads' );

-- Permitir que usuários autenticados enviem imagens
CREATE POLICY "Usuários autenticados podem enviar imagens"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'ads' );

-- Permitir que o dono da imagem a delete ou atualize
CREATE POLICY "Usuários podem deletar suas próprias imagens"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'ads' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Usuários podem atualizar suas próprias imagens"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'ads' AND (storage.foldername(name))[1] = auth.uid()::text );
