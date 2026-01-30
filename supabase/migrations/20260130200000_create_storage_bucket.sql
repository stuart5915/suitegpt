-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proto-golf-images', 'proto-golf-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read proto-golf-images" ON storage.objects
    FOR SELECT USING (bucket_id = 'proto-golf-images');

-- Allow anyone to upload (admin auth handled at app layer)
CREATE POLICY "Allow upload proto-golf-images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'proto-golf-images');

-- Allow anyone to delete
CREATE POLICY "Allow delete proto-golf-images" ON storage.objects
    FOR DELETE USING (bucket_id = 'proto-golf-images');
