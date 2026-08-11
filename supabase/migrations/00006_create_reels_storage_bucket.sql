
-- Create reels storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reels',
  'reels',
  true,
  104857600,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/mov', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for reels bucket
CREATE POLICY "Public reels read" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "Auth users upload reels" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own reels" ON storage.objects FOR DELETE USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);
