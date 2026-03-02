
INSERT INTO storage.buckets (id, name, public) VALUES ('keysystem-logos', 'keysystem-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view keysystem logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'keysystem-logos');

CREATE POLICY "Authenticated users can upload keysystem logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'keysystem-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own keysystem logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'keysystem-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own keysystem logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'keysystem-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
