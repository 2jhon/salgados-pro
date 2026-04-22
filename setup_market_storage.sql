
-- Script para preparar o bucket de imagens da vitrine do marketplace
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_banners', 'app_banners', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Segurança para 'app_banners'
CREATE POLICY "Imagens de vitrine são públicas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'app_banners' );

CREATE POLICY "Usuários podem enviar imagens para vitrine"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'app_banners' );

CREATE POLICY "Usuários podem gerenciar suas próprias imagens de vitrine"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'app_banners' AND (storage.foldername(name))[1] = auth.uid()::text );
